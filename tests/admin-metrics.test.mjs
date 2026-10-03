import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAdminDateTime, revenueForRange, revenueWindow } from '../src/lib/admin-metrics.ts';

test('revenue periods use Ghana calendar boundaries and count paid orders only', () => {
  const now = new Date('2026-10-07T15:00:00Z'); // Wednesday
  const orders = [
    { paymentStatus: 'paid', paidAt: '2026-10-07T00:00:00Z', createdAt: '2026-10-06T12:00:00Z', amountPaid: 90, price: 100 },
    { paymentStatus: 'paid', paidAt: '2026-10-05T00:00:00Z', createdAt: '2026-10-05T00:00:00Z', price: 40 },
    { paymentStatus: 'paid', paidAt: '2026-09-20T00:00:00Z', createdAt: '2026-09-20T00:00:00Z', price: 30 },
    { paymentStatus: 'paid', paidAt: '2026-09-01T00:00:00Z', createdAt: '2026-09-01T00:00:00Z', price: 20 },
    { paymentStatus: 'unpaid', createdAt: '2026-10-07T01:00:00Z', price: 1000 }
  ];
  assert.deepEqual(revenueForRange(orders, 'allTime', now), { amount: 180, count: 4 });
  assert.deepEqual(revenueForRange(orders, 'today', now), { amount: 90, count: 1 });
  assert.deepEqual(revenueForRange(orders, 'week', now), { amount: 130, count: 2 });
  assert.deepEqual(revenueForRange(orders, 'last30', now), { amount: 160, count: 3 });
  assert.deepEqual(revenueForRange(orders, 'lastMonth', now), { amount: 50, count: 2 });
  assert.deepEqual(revenueForRange([
    { paymentStatus: 'paid', paidAt: '2026-10-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z', price: 75 }
  ], 'lastMonth', now), { amount: 0, count: 0 });
  assert.equal(revenueWindow('week', now).start, Date.parse('2026-10-05T00:00:00Z'));
});

test('admin date and time includes AM or PM', () => {
  assert.match(formatAdminDateTime('2026-10-07T15:00:00Z'), /3:00 PM/);
  assert.match(formatAdminDateTime('2026-10-07T03:00:00Z'), /3:00 AM/);
});
