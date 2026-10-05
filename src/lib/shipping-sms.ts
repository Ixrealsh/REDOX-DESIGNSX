import type { Order } from '@/types/product';

/** Keep this message plain ASCII so Hubtel bills it as GSM-7. */
export function buildShippedSms(order: Pick<Order, 'id'>): string {
  return `REDOXDESIGNX: Order RD-${order.id} has shipped. ` +
    'Please expect a call from our delivery team to arrange delivery. ' +
    `Track: redoxdesignx.com/track-order?ref=RD-${order.id}`;
}
