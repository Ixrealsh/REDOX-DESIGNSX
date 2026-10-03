export const GHANA_REGIONS = [
  'Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central', 'Volta',
  'Northern', 'Upper East', 'Upper West', 'Savannah', 'North East',
  'Bono', 'Bono East', 'Ahafo', 'Western North', 'Oti'
] as const;

export type DeliveryMethod = 'none' | 'standard' | 'urgent';

export const FREE_STATION_DELIVERY_LABEL = 'Free Delivery to Station';
export const URGENT_STATION_DELIVERY_LABEL = 'Urgent Delivery to Station';
export const FREE_STATION_DELIVERY_DETAILS = 'Station deliveries run on Monday, Wednesday and Friday via VIP, OA and Express Bus.';

export interface DeliverySettings {
  eligibleRegions: string[];
  urgentFee: number;
}

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  eligibleRegions: GHANA_REGIONS.filter((region) => region !== 'Greater Accra'),
  urgentFee: 0
};

export function normalizeDeliverySettings(value: unknown): DeliverySettings {
  const input = value && typeof value === 'object' ? value as Partial<DeliverySettings> : {};
  const allowed = new Set<string>(DEFAULT_DELIVERY_SETTINGS.eligibleRegions);
  const eligibleRegions = Array.isArray(input.eligibleRegions)
    ? [...new Set(input.eligibleRegions.filter((region): region is string => typeof region === 'string' && allowed.has(region)))]
    : [...DEFAULT_DELIVERY_SETTINGS.eligibleRegions];
  const fee = Number(input.urgentFee);
  return {
    eligibleRegions,
    urgentFee: Number.isFinite(fee) && fee > 0 ? Math.round(fee * 100) / 100 : 0
  };
}

export function deliveryQuote(
  region: string,
  requested: 'standard' | 'urgent' | undefined,
  settings: DeliverySettings
): { method: DeliveryMethod; fee: number; error?: string } {
  const eligible = region !== 'Greater Accra' && settings.eligibleRegions.includes(region);
  if (!eligible) {
    return requested === 'urgent'
      ? { method: 'none', fee: 0, error: 'Urgent Delivery to Station is not available for this region.' }
      : { method: 'none', fee: 0 };
  }
  if (requested === 'urgent') {
    return settings.urgentFee > 0
      ? { method: 'urgent', fee: settings.urgentFee }
      : { method: 'standard', fee: 0, error: 'Urgent Delivery to Station is not available right now.' };
  }
  return { method: 'standard', fee: 0 };
}
