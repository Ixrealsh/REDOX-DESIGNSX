import { neon } from '@neondatabase/serverless';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('No DATABASE_URL configured');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  try {
    console.log('Altering orders table...');
    await sql`ALTER TABLE orders ALTER COLUMN selected_size TYPE text, ALTER COLUMN selected_color TYPE text, ALTER COLUMN payment_method TYPE text, ALTER COLUMN momo_network TYPE text, ALTER COLUMN momo_number TYPE text, ALTER COLUMN status TYPE text;`;
    console.log('Successfully altered columns to text.');
  } catch (err) {
    console.error('Failed to alter table:', err);
  }
}

main();
