/** Store reporting uses Ghana's calendar day (UTC year-round). */
export type RevenueRange = 'allTime' | 'today' | 'week' | 'last30' | 'lastMonth';

interface PaidOrder {
  paymentStatus: string;
  paidAt?: string;
  createdAt: string;
  amountPaid?: number;
  price: number;
}

export function revenueWindow(range: RevenueRange, now = new Date()) {
  if (range === 'allTime') return { start: Number.NEGATIVE_INFINITY, end: Number.POSITIVE_INFINITY };
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (range === 'today') return { start: today.getTime(), end: now.getTime() + 1 };
  if (range === 'week') {
    const monday = new Date(today);
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    return { start: monday.getTime(), end: now.getTime() + 1 };
  }
  if (range === 'last30') return { start: now.getTime() - 30 * 24 * 60 * 60 * 1000, end: now.getTime() + 1 };
  return {
    start: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    end: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  };
}

export function revenueForRange(orders: PaidOrder[], range: RevenueRange, now = new Date()) {
  const { start, end } = revenueWindow(range, now);
  let amount = 0;
  let count = 0;
  for (const order of orders) {
    if (order.paymentStatus !== 'paid') continue;
    const paidAt = new Date(order.paidAt || order.createdAt).getTime();
    if (!Number.isFinite(paidAt) || paidAt < start || paidAt >= end) continue;
    amount += Number(order.amountPaid ?? order.price) || 0;
    count += 1;
  }
  return { amount: Math.round(amount * 100) / 100, count };
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Accra',
  dateStyle: 'medium',
  timeStyle: 'short',
  hour12: true
});

export function formatAdminDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateTimeFormatter.format(date);
}
