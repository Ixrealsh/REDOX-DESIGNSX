export const FREE_SHIPPING_THRESHOLD = Number(
  process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD || 100
);

/** Service charge rate applied to every purchase (2%). */
export const SERVICE_CHARGE_RATE = 0.02;

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    maximumFractionDigits: 2
  }).format(amount);
}

/** Calculate the service charge for a given subtotal. */
export function calcServiceCharge(subtotal: number): number {
  return Math.round(subtotal * SERVICE_CHARGE_RATE * 100) / 100;
}

/** Calculate the final order total (subtotal + service charge). */
export function calcOrderTotal(subtotal: number): number {
  return subtotal + calcServiceCharge(subtotal);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
