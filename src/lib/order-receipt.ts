import type { Order, PaymentStatus } from '@/types/product';

/**
 * The view of an order that is safe to hand back to the browser.
 *
 * Internal bookkeeping — gateway responses, verification source, stock and SMS
 * claims, admin notes — stays on the server; the customer gets their receipt.
 */
export interface CustomerReceipt {
  id: number;
  orderNumber: string;
  reference?: string;
  items: Order['items'];
  totalQuantity: number;
  subtotal: number;
  serviceCharge: number;
  discount: number;
  price: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  shippingCity: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paymentChannel?: string;
  paidAt?: string;
  amountPaid?: number;
  status: string;
  createdAt: string;
  /** Retained for the existing receipt UI, which reads these summaries. */
  productName: string;
  selectedColor: string;
  selectedSize: string;
}

/** Money roll-up shown at the top of the admin orders tab. */
export interface OrderPaymentSummary {
  total: number;
  paid: number;
  unpaid: number;
  failed: number;
  abandoned: number;
  refunded: number;
  /** Money actually captured, across every paid order. */
  paidRevenue: number;
  /** Value sitting in orders that have not been confirmed as paid. */
  unpaidValue: number;
  /** Unpaid card orders older than an hour — these want a human's attention. */
  needsAttention: number;
}

export function summariseOrderPayments(orders: Order[]): OrderPaymentSummary {
  const hourAgo = Date.now() - 60 * 60 * 1000;

  const summary: OrderPaymentSummary = {
    total: orders.length,
    paid: 0,
    unpaid: 0,
    failed: 0,
    abandoned: 0,
    refunded: 0,
    paidRevenue: 0,
    unpaidValue: 0,
    needsAttention: 0
  };

  for (const order of orders) {
    switch (order.paymentStatus) {
      case 'paid':
        summary.paid += 1;
        summary.paidRevenue += Number(order.amountPaid ?? order.price) || 0;
        break;
      case 'failed':
        summary.failed += 1;
        break;
      case 'abandoned':
        summary.abandoned += 1;
        break;
      case 'refunded':
        summary.refunded += 1;
        break;
      default:
        summary.unpaid += 1;
        summary.unpaidValue += Number(order.price) || 0;
        if (order.paymentMethod === 'PAYSTACK' && new Date(order.createdAt).getTime() < hourAgo) {
          summary.needsAttention += 1;
        }
    }
  }

  summary.paidRevenue = Math.round(summary.paidRevenue * 100) / 100;
  summary.unpaidValue = Math.round(summary.unpaidValue * 100) / 100;
  return summary;
}

export function toCustomerReceipt(order: Order): CustomerReceipt {
  return {
    id: order.id,
    orderNumber: `RD-${order.id}`,
    reference: order.paymentReference || order.momoNumber,
    items: order.items,
    totalQuantity: order.totalQuantity,
    subtotal: order.subtotal,
    serviceCharge: order.serviceCharge,
    discount: order.discount,
    price: order.price,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    shippingAddress: order.shippingAddress,
    shippingCity: order.shippingCity,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paymentChannel: order.paymentChannel,
    paidAt: order.paidAt,
    amountPaid: order.amountPaid,
    status: order.status,
    createdAt: order.createdAt,
    productName: order.productName,
    selectedColor: order.selectedColor,
    selectedSize: order.selectedSize
  };
}
