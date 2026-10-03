import { isDbConfigured, sql } from '@/lib/db';
import { DEFAULT_DELIVERY_SETTINGS, normalizeDeliverySettings, type DeliverySettings } from '@/lib/delivery';

let schemaPromise: Promise<void> | null = null;

async function ensureDeliverySettingsTable() {
  if (!schemaPromise) {
    schemaPromise = sql`
      CREATE TABLE IF NOT EXISTS delivery_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        eligible_regions JSONB NOT NULL,
        urgent_fee NUMERIC(10, 2) NOT NULL DEFAULT 0
      )
    `.then(() => undefined).catch((error: unknown) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

export async function getDeliverySettings(): Promise<DeliverySettings> {
  if (!isDbConfigured) return DEFAULT_DELIVERY_SETTINGS;
  await ensureDeliverySettingsTable();
  const rows = await sql`SELECT eligible_regions, urgent_fee FROM delivery_settings WHERE id = 1`;
  if (!rows[0]) return DEFAULT_DELIVERY_SETTINGS;
  const regions = typeof rows[0].eligible_regions === 'string'
    ? JSON.parse(rows[0].eligible_regions)
    : rows[0].eligible_regions;
  return normalizeDeliverySettings({ eligibleRegions: regions, urgentFee: rows[0].urgent_fee });
}

export async function saveDeliverySettings(settings: DeliverySettings): Promise<DeliverySettings> {
  if (!isDbConfigured) throw new Error('Database is unavailable. Delivery settings were not saved.');
  await ensureDeliverySettingsTable();
  const clean = normalizeDeliverySettings(settings);
  await sql`
    INSERT INTO delivery_settings (id, eligible_regions, urgent_fee)
    VALUES (1, ${JSON.stringify(clean.eligibleRegions)}::jsonb, ${clean.urgentFee})
    ON CONFLICT (id) DO UPDATE SET
      eligible_regions = EXCLUDED.eligible_regions,
      urgent_fee = EXCLUDED.urgent_fee
  `;
  return clean;
}
