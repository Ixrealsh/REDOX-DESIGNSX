import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveUnitPrice, quantityByProduct } from '../src/lib/wholesale.ts';
import { adminOrderSchema, resolveDiscount, sumOrderExtras } from '../src/lib/order-schema.ts';
import { adjudicatePayment, buildPaymentReference } from '../src/lib/paystack-server.ts';
import { parsePublicOrderId } from '../src/lib/order-reference.ts';
import { deliveryQuote, normalizeDeliverySettings } from '../src/lib/delivery.ts';

test('delivery options apply only to selected regions and price urgent delivery', () => {
  const settings = normalizeDeliverySettings({ eligibleRegions: ['Ashanti', 'Greater Accra'], urgentFee: 25 });
  assert.deepEqual(settings.eligibleRegions, ['Ashanti']);
  assert.deepEqual(deliveryQuote('Ashanti', 'standard', settings), { method: 'standard', fee: 0 });
  assert.deepEqual(deliveryQuote('Ashanti', 'urgent', settings), { method: 'urgent', fee: 25 });
  assert.equal(deliveryQuote('Greater Accra', 'urgent', settings).error, 'Urgent delivery is not available for this region.');
  assert.deepEqual(deliveryQuote('Western', 'standard', settings), { method: 'none', fee: 0 });
  assert.ok(deliveryQuote('Ashanti', 'urgent', { ...settings, urgentFee: 0 }).error);
});

test('bulk pricing combines sizes and colors of one product', () => {
  const counts = quantityByProduct([
    { productSlug: 'tee', quantity: 2 },
    { productSlug: 'tee', quantity: 3 },
    { productSlug: 'hoodie', quantity: 1 }
  ]);
  assert.equal(counts.get('tee'), 5);
  assert.equal(effectiveUnitPrice({ price: 100, wholesale: { minQuantity: 5, unitPrice: 80 } }, counts.get('tee')), 80);
  assert.equal(effectiveUnitPrice({ price: 100, wholesale: { minQuantity: 5, unitPrice: 80 } }, 4), 100);
});

test('manual order charges and discounts cannot make a negative total', () => {
  assert.equal(sumOrderExtras([{ amount: 12.345 }, { amount: 7.65 }]), 20);
  assert.equal(resolveDiscount(120, 'percent', 10), 12);
  assert.equal(resolveDiscount(120, 'amount', 500), 120);
  assert.equal(adminOrderSchema.safeParse({ customerName: 'A', customerPhone: '123' }).success, false);
});

test('verified payment must match amount and currency', () => {
  assert.equal(adjudicatePayment({ status: 'success', currency: 'GHS', amount: 10200 }, 102).outcome, 'paid');
  assert.equal(adjudicatePayment({ status: 'success', currency: 'GHS', amount: 10199 }, 102).outcome, 'mismatch');
  assert.equal(adjudicatePayment({ status: 'success', currency: 'USD', amount: 10200 }, 102).outcome, 'mismatch');
  assert.equal(adjudicatePayment({ status: 'pending' }, 102).outcome, 'pending');
});

test('order numbers and gateway references stay distinct', () => {
  assert.equal(parsePublicOrderId('#RD-42'), 42);
  assert.equal(parsePublicOrderId('RD-42extra'), null);
  assert.equal(parsePublicOrderId('RDX-42-1234'), null);
  assert.match(buildPaymentReference(42), /^RDX-42-[A-F0-9]{8}$/);
});
