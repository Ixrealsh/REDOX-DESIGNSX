export const FREE_SHIPPING_THRESHOLD = Number(
  process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD || 100
);

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    maximumFractionDigits: 0
  }).format(amount);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
