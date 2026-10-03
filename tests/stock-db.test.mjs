import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const source = await readFile(new URL('../src/lib/catalog-db.ts', import.meta.url), 'utf8');
const functionSql = source.match(/CREATE OR REPLACE FUNCTION create_order_with_reservation\([\s\S]*?\$fn\$;/)?.[0];
assert.ok(functionSql, 'stock and order function is present');

function order(clientRequestId, slug) {
  return {
    productId: slug,
    productName: slug,
    productSlug: slug,
    selectedColor: 'Black',
    selectedSize: 'M',
    price: 100,
    customerName: 'Test Customer',
    customerPhone: '0240000000',
    customerEmail: 'test@example.com',
    shippingAddress: 'Test address',
    shippingCity: 'Accra',
    paymentMethod: 'COD',
    items: [],
    totalQuantity: 1,
    subtotal: 100,
    serviceCharge: 0,
    clientRequestId
  };
}

test('stock and order creation commit or roll back together', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'visible', variants JSONB NOT NULL
      );
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY, product_id TEXT, product_name TEXT, product_slug TEXT,
        selected_color TEXT, selected_size TEXT, price NUMERIC, customer_name TEXT,
        customer_phone TEXT, customer_email TEXT, shipping_address TEXT,
        shipping_city TEXT, payment_method TEXT, momo_network TEXT, momo_number TEXT,
        status TEXT, items JSONB, total_quantity INTEGER, subtotal NUMERIC,
        service_charge NUMERIC, payment_status TEXT, payment_reference TEXT,
        paid_at TIMESTAMPTZ, amount_paid NUMERIC, payment_channel TEXT,
        paystack_transaction_id TEXT, last_verified_at TIMESTAMPTZ,
        payment_verified_by TEXT, gateway_response TEXT, stock_reserved BOOLEAN,
        stock_released BOOLEAN, sms_sent BOOLEAN, discount NUMERIC, source TEXT,
        client_request_id TEXT UNIQUE, payment_note TEXT, extras JSONB,
        delivery_method TEXT NOT NULL DEFAULT 'none', delivery_fee NUMERIC NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX orders_payment_reference_uidx ON orders (payment_reference)
        WHERE payment_reference IS NOT NULL;
    `);
    await db.exec(functionSql);
    for (const [slug, inventory] of [['a', 1], ['b', 0], ['c', 1], ['d', 2], ['e', 2], ['f', 1]]) {
      await db.query('INSERT INTO products (id, slug, variants) VALUES ($1, $1, $2::jsonb)', [
        slug, JSON.stringify([{ color: 'Black', size: 'M', inventory, stockStatus: inventory ? 'in_stock' : 'out_of_stock' }])
      ]);
    }

    const create = (key, lines, slug = lines[0].productSlug, options = {}) => db.query(
      'SELECT id FROM create_order_with_reservation($1::jsonb, $2::jsonb, $3)',
      [JSON.stringify({ ...order(key, slug), ...options }), JSON.stringify(lines), options.allowShortfall === true]
    );
    const line = (productSlug) => ({ productSlug, color: 'Black', size: 'M', quantity: 1 });

    const lastItem = await Promise.allSettled([
      create('first-attempt', [line('a')]),
      create('second-attempt', [line('a')])
    ]);
    assert.equal(lastItem.filter((result) => result.status === 'fulfilled').length, 1,
      lastItem.map((result) => result.status === 'rejected' ? result.reason?.message : 'fulfilled').join(' | '));
    assert.equal((await db.query('SELECT COUNT(*)::INTEGER AS count FROM orders')).rows[0].count, 1);
    assert.equal((await db.query("SELECT variants->0->>'inventory' AS stock FROM products WHERE slug='a'")).rows[0].stock, '0');

    await assert.rejects(create('multi-product', [line('c'), line('b')], 'c'));
    assert.equal((await db.query("SELECT variants->0->>'inventory' AS stock FROM products WHERE slug='c'")).rows[0].stock, '1');

    await create('same-request', [line('d')]);
    await assert.rejects(create('same-request', [line('d')]));
    assert.equal((await db.query("SELECT variants->0->>'inventory' AS stock FROM products WHERE slug='d'")).rows[0].stock, '1');

    await create('gateway-first', [line('e')], 'e', { paymentReference: 'RDX-TEST-1' });
    await assert.rejects(create('gateway-retry', [line('e')], 'e', { paymentReference: 'RDX-TEST-1' }));
    assert.equal((await db.query("SELECT variants->0->>'inventory' AS stock FROM products WHERE slug='e'")).rows[0].stock, '1');

    await db.query("UPDATE products SET visibility='hidden' WHERE slug='f'");
    await assert.rejects(create('hidden-web', [line('f')]));
    await create('hidden-admin', [line('f')], 'f', { allowShortfall: true, source: 'admin' });

    await create('urgent-order', [line('e')], 'e', { price: 125, deliveryMethod: 'urgent', deliveryFee: 25 });
    const urgent = (await db.query("SELECT delivery_method, delivery_fee::NUMERIC AS delivery_fee, price::NUMERIC AS price FROM orders WHERE client_request_id='urgent-order'")).rows[0];
    assert.equal(urgent.delivery_method, 'urgent');
    assert.equal(Number(urgent.delivery_fee), 25);
    assert.equal(Number(urgent.price), 125);
  } finally {
    await db.close();
  }
});
