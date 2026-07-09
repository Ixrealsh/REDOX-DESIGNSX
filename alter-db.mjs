import { neon } from '@neondatabase/serverless';

/**
 * Standalone migration for an existing `orders` table.
 *
 * The app also runs this automatically (see ensureOrdersSchema in src/lib/catalog-db.ts),
 * so this script is only needed to migrate ahead of a deploy. It is idempotent.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('No DATABASE_URL configured');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  try {
    console.log('Widening flattened summary columns to TEXT...');
    await sql`
      ALTER TABLE orders
        ALTER COLUMN selected_size TYPE TEXT,
        ALTER COLUMN selected_color TYPE TEXT,
        ALTER COLUMN payment_method TYPE TEXT,
        ALTER COLUMN momo_network TYPE TEXT,
        ALTER COLUMN momo_number TYPE TEXT,
        ALTER COLUMN status TYPE TEXT
    `;

    console.log('Adding line-item columns...');
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_quantity INTEGER NOT NULL DEFAULT 1`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge NUMERIC`;

    console.log('Migration complete.');
  } catch (err) {
    console.error('Failed to alter table:', err);
    process.exit(1);
  }
}

main();
