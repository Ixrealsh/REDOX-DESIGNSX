'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import type { Product, Drop, Collection, LookbookIssue, Order } from '@/types/product';
import type { OrderPaymentSummary } from '@/lib/order-receipt';
import type { WaitlistSignup } from '@/lib/catalog-db';
import { formatCurrency } from '@/lib/format';
import { getProductStockSummary } from '@/lib/inventory';
import styles from './Admin.module.css';

interface AdminDashboardProps {
  isDbConnected: boolean;
  isCloudinaryConnected: boolean;
  initialProducts: Product[];
  initialDrops: Drop[];
  initialCollections: Collection[];
  initialLookbooks: LookbookIssue[];
  initialWaitlist: WaitlistSignup[];
}

type AdminStockStatus = 'in_stock' | 'out_of_stock';

interface AdminSizeStock {
  size: string;
  stockStatus: AdminStockStatus;
  stockQuantity: string;
}

interface AdminColorVariant {
  colorName: string;
  imageUrls: string[];
  sizes: AdminSizeStock[];
}

const defaultSizes = ['S', 'M', 'L', 'XL', 'XXL'];

function createSizeRows(sizes = defaultSizes): AdminSizeStock[] {
  return sizes.map((size) => ({
    size,
    stockStatus: 'in_stock',
    stockQuantity: ''
  }));
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const BRAND_PHONE = '+233 55 805 8348';
const BRAND_URL = 'https://redoxdesignx.com';

/** Escape user-supplied text before it lands in the print document's markup. */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ghs(amount: number): string {
  return `GH₵${Number(amount || 0).toFixed(2)}`;
}

// ----------------------------------------------------------------
// Payment presentation
// ----------------------------------------------------------------

export type PaymentFilter = 'all' | 'paid' | 'unpaid' | 'attention' | 'failed';

interface PaymentBadgeStyle {
  label: string;
  color: string;
  background: string;
}

/**
 * One place that decides how a payment state looks, so the table, the filters
 * and the printed slip can never disagree about whether an order is paid.
 */
function paymentBadge(order: Order): PaymentBadgeStyle {
  switch (order.paymentStatus) {
    case 'paid':
      return { label: '✓ PAID', color: '#10b981', background: 'rgba(16, 185, 129, 0.16)' };
    case 'failed':
      return { label: '✕ PAYMENT FAILED', color: '#ef4444', background: 'rgba(239, 68, 68, 0.16)' };
    case 'abandoned':
      return { label: '○ ABANDONED', color: '#9ca3af', background: 'rgba(156, 163, 175, 0.14)' };
    case 'refunded':
      return { label: '↩ REFUNDED', color: '#a78bfa', background: 'rgba(167, 139, 250, 0.16)' };
    default:
      return { label: '● NOT PAID', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.16)' };
  }
}

/** Unpaid card orders more than an hour old are the ones worth chasing. */
function needsAttention(order: Order): boolean {
  return (
    order.paymentStatus === 'unpaid' &&
    order.paymentMethod === 'PAYSTACK' &&
    Date.now() - new Date(order.createdAt).getTime() > 60 * 60 * 1000
  );
}

function matchesPaymentFilter(order: Order, filter: PaymentFilter): boolean {
  switch (filter) {
    case 'paid':
      return order.paymentStatus === 'paid';
    case 'unpaid':
      return order.paymentStatus === 'unpaid';
    case 'attention':
      return needsAttention(order);
    case 'failed':
      return order.paymentStatus === 'failed' || order.paymentStatus === 'abandoned';
    default:
      return true;
  }
}

function formatChannel(channel?: string): string {
  if (!channel) return '';
  return channel.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Build a self-contained, white, print-ready order slip for a single order. */
function buildOrderSlipHtml(order: Order, origin: string): string {
  const ref = `#RD-${order.id}`;
  const logoSrc = `${origin}/assets/icons/redoxlogo.jpg`;

  const isPaid = order.paymentStatus === 'paid';
  const reference = order.paymentReference || order.momoNumber || '';

  const methodLabel =
    order.paymentMethod === 'PAYSTACK'
      ? `Paystack${order.paymentChannel ? ` — ${formatChannel(order.paymentChannel)}` : ''}`
      : order.paymentMethod === 'COD'
      ? 'Cash on delivery'
      : `Mobile money${order.momoNetwork ? ` (${order.momoNetwork})` : ''}`;

  // The line under the stamp is what tells a rider or packer, at a glance,
  // whether money still has to be collected on this order.
  const paymentLine = isPaid
    ? `${ghs(order.amountPaid ?? order.price)} received${order.paidAt ? ` on ${new Date(order.paidAt).toLocaleString()}` : ''}`
    : order.paymentStatus === 'failed'
    ? 'The gateway declined this payment — do not dispatch.'
    : order.paymentStatus === 'abandoned'
    ? 'Checkout was abandoned — do not dispatch.'
    : order.paymentStatus === 'refunded'
    ? 'This order was refunded.'
    : `Collect ${ghs(order.price)} before handover.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Order ${escapeHtml(ref)} — RedoxDesignx</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #f2f2f2; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    width: 76mm;
    min-height: 130mm;
    margin: 12px auto;
    background: #fff;
    padding: 7mm 6mm;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  }
  .brand {
    text-align: center;
    border-bottom: 1.5px solid #111;
    padding-bottom: 9px;
  }
  .brand img { height: 40px; width: auto; object-fit: contain; display: block; margin: 0 auto; }
  .brand .name {
    margin-top: 6px;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .gap { margin-top: 14px; }
  .section-title {
    font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase;
    color: #999; margin-bottom: 7px;
  }
  .recipient { font-size: 14px; font-weight: 800; margin-bottom: 8px; }
  .field { padding: 5px 0; border-bottom: 1px dashed #e6e6e6; }
  .field:last-child { border-bottom: none; }
  .field .l { font-size: 7.5px; letter-spacing: 0.14em; text-transform: uppercase; color: #aaa; }
  .field .d { font-size: 11px; color: #111; margin-top: 2px; word-break: break-word; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stat { border: 1px solid #eaeaea; border-radius: 5px; padding: 9px 6px; text-align: center; }
  .stat .l { font-size: 7.5px; letter-spacing: 0.14em; text-transform: uppercase; color: #aaa; }
  .stat .d { font-size: 15px; font-weight: 800; margin-top: 4px; }
  .lines { border-top: 1px solid #eee; }
  .line { display: flex; justify-content: space-between; gap: 8px; padding: 6px 0; border-bottom: 1px dashed #eee; }
  .line .n { font-size: 10.5px; font-weight: 700; }
  .line .v { font-size: 9px; color: #666; margin-top: 1px; }
  .line .p { font-size: 10.5px; font-weight: 700; white-space: nowrap; }
  .sums { margin-top: 10px; }
  .sum { display: flex; justify-content: space-between; font-size: 10px; color: #444; padding: 2px 0; }
  .total {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 10px; padding: 11px 12px; background: #111; border-radius: 5px;
  }
  .total .k { font-size: 8.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #bbb; }
  .total .v { font-size: 19px; font-weight: 800; color: #fff; }
  .stamp {
    margin-top: 12px; padding: 9px 10px; border-radius: 5px; text-align: center;
    font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
  }
  .stamp.paid { background: #e7f8f0; color: #067a52; border: 1.5px solid #067a52; }
  .stamp.unpaid { background: #fff4e5; color: #a35b00; border: 1.5px dashed #a35b00; }
  .stamp .sub { display: block; font-size: 8px; font-weight: 600; letter-spacing: 0.06em; margin-top: 3px; text-transform: none; }
  .foot {
    margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd;
    text-align: center; font-size: 9px; color: #666; line-height: 1.6;
  }
  .foot .thanks { font-weight: 700; color: #111; margin-bottom: 3px; }
  @media print {
    html, body { background: #fff; }
    .sheet { margin: 0; box-shadow: none; width: auto; min-height: auto; padding: 0; }
    @page { size: 76mm 130mm; margin: 5mm; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="brand">
      <img src="${escapeHtml(logoSrc)}" alt="RedoxDesignx" />
      <div class="name">RedoxDesignx</div>
    </div>

    <div class="gap">
      <div class="section-title">Customer</div>
      <div class="recipient">${escapeHtml(order.customerName)}</div>
      <div class="field">
        <div class="l">Location</div>
        <div class="d">${escapeHtml(order.shippingAddress)}, ${escapeHtml(order.shippingCity)}</div>
      </div>
      <div class="field">
        <div class="l">Phone</div>
        <div class="d">${escapeHtml(order.customerPhone)}</div>
      </div>
      <div class="field">
        <div class="l">Email</div>
        <div class="d">${escapeHtml(order.customerEmail)}</div>
      </div>
    </div>

    <div class="gap">
      <div class="section-title">Order</div>
      <div class="stats">
        <div class="stat">
          <div class="l">Order ID</div>
          <div class="d">${escapeHtml(ref)}</div>
        </div>
        <div class="stat">
          <div class="l">Total Items</div>
          <div class="d">${escapeHtml(order.totalQuantity)}</div>
        </div>
      </div>
    </div>

    <div class="gap">
      <div class="section-title">Items</div>
      <div class="lines">
        ${order.items
          .map(
            (item) => `
        <div class="line">
          <div>
            <div class="n">${escapeHtml(item.productName)}</div>
            <div class="v">${escapeHtml(item.color)} / ${escapeHtml(item.size)} &times; ${escapeHtml(item.quantity)}${
              item.sku ? ` &middot; ${escapeHtml(item.sku)}` : ''
            }</div>
          </div>
          <div class="p">${ghs(item.lineTotal)}</div>
        </div>`
          )
          .join('')}
      </div>
      <div class="sums">
        <div class="sum"><span>Subtotal</span><span>${ghs(order.subtotal)}</span></div>
        <div class="sum"><span>Service fee (2%)</span><span>${ghs(order.serviceCharge)}</span></div>
      </div>
    </div>

    <div class="total">
      <span class="k">Total Amount</span>
      <span class="v">${ghs(order.price)}</span>
    </div>

    <div class="stamp ${isPaid ? 'paid' : 'unpaid'}">
      ${isPaid ? 'Paid in full' : 'Payment outstanding'}
      <span class="sub">${escapeHtml(paymentLine)}</span>
    </div>

    <div class="gap">
      <div class="section-title">Payment</div>
      <div class="field">
        <div class="l">Method</div>
        <div class="d">${escapeHtml(methodLabel)}</div>
      </div>
      ${
        reference
          ? `<div class="field">
        <div class="l">Reference</div>
        <div class="d">${escapeHtml(reference)}</div>
      </div>`
          : ''
      }
      <div class="field">
        <div class="l">Placed</div>
        <div class="d">${escapeHtml(new Date(order.createdAt).toLocaleString())}</div>
      </div>
      <div class="field">
        <div class="l">Fulfilment</div>
        <div class="d">${escapeHtml(order.status || 'Pending')}</div>
      </div>
    </div>

    <div class="foot">
      <div class="thanks">Thank you for shopping with RedoxDesignx.</div>
      <div>${escapeHtml(BRAND_PHONE)}</div>
      <div>${escapeHtml(BRAND_URL)}</div>
    </div>
  </div>
</body>
</html>`;
}

export function AdminDashboard({
  isDbConnected: initialDbStatus,
  isCloudinaryConnected: initialCloudinaryStatus,
  initialProducts,
  initialDrops,
  initialCollections,
  initialLookbooks,
  initialWaitlist
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'drops' | 'collections' | 'lookbooks' | 'waitlist' | 'orders'>('products');
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [drops, setDrops] = useState<Drop[]>(initialDrops);
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [lookbooks, setLookbooks] = useState<LookbookIssue[]>(initialLookbooks);
  const [waitlist, setWaitlist] = useState<WaitlistSignup[]>(initialWaitlist);
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<OrderPaymentSummary | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [isDbConnected, setIsDbConnected] = useState(initialDbStatus);

  // Database Initializing State
  const [isInitializing, setIsInitializing] = useState(false);
  const [isRefreshingWaitlist, setIsRefreshingWaitlist] = useState(false);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  /** The order whose payment action is in flight, so its row can show progress. */
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  
  // Form Modal States
  const [showProductModal, setShowProductModal] = useState(false);
  const [showDropModal, setShowDropModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showLookbookModal, setShowLookbookModal] = useState(false);
  
  // Notification State
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Cloudinary Upload States
  const [uploadingImageField, setUploadingImageField] = useState<'product' | 'drop' | 'collection' | 'lookbook' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Product Form State
  const [productForm, setProductForm] = useState({
    id: '',
    slug: '',
    name: '',
    price: '',
    category: '',
    collectionSlug: '',
    collectionName: '',
    badge: '',
    image: '',
    description: '',
    story: '',
    material: '100% compact cotton',
    fit: 'Boxy fit, true to size',
    colors: 'Obsidian Black, Oxide Bone',
    colorImagesStr: '',
    sizes: 'S, M, L, XL, XXL',
    details: '240GSM compact cotton jersey\nBoxy shoulder\nTwin needle hem',
    care: 'Machine wash cold\nHang dry\nIron low'
  });

  // Dynamic Color Variant state
  const [colorVariants, setColorVariants] = useState<AdminColorVariant[]>([]);
  const [activeVariantUploadIndex, setActiveVariantUploadIndex] = useState<number | null>(null);
  const variantFileInputRef = useRef<HTMLInputElement>(null);

  // Drop Form State
  const [dropForm, setDropForm] = useState({
    slug: '',
    name: '',
    status: 'upcoming' as 'upcoming' | 'archive' | 'live',
    releaseDate: '',
    itemCount: '',
    summary: '',
    image: ''
  });

  // Collection Form State
  const [collectionForm, setCollectionForm] = useState({
    slug: '',
    name: '',
    tagline: '',
    description: '',
    image: '',
    productSlugs: '' // Comma separated, e.g. "oxide-heavyweight-tee, catalyst-heavyweight-hoodie"
  });

  // Lookbook Form State
  const [lookbookForm, setLookbookForm] = useState({
    slug: '',
    title: '',
    season: '',
    dek: '',
    image: '',
    featuredProductSlugs: '' // Comma separated
  });

  // Handle Notifications
  const triggerNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Fetch Latest Waitlist Leads
  const refreshWaitlist = async () => {
    setIsRefreshingWaitlist(true);
    try {
      const response = await fetch('/api/admin/waitlist');
      const data = await response.json();
      if (response.ok && Array.isArray(data.waitlist)) {
        setWaitlist(data.waitlist);
        triggerNotification('Waitlist signups synced live from Neon DB!', 'success');
      }
    } catch (err: any) {
      triggerNotification(err.message || 'Failed to sync waitlist signups.', 'error');
    } finally {
      setIsRefreshingWaitlist(false);
    }
  };

  // Fetch Latest Placed Orders
  const refreshOrders = async (options?: { silent?: boolean }) => {
    setIsRefreshingOrders(true);
    try {
      const response = await fetch('/api/admin/orders');
      const data = await response.json();
      if (response.ok && Array.isArray(data.orders)) {
        setOrders(data.orders);
        setPaymentSummary(data.summary || null);
        if (!options?.silent) {
          triggerNotification('Customer orders synced live from Neon DB!', 'success');
        }
      }
    } catch (err: any) {
      triggerNotification(err.message || 'Failed to sync orders.', 'error');
    } finally {
      setIsRefreshingOrders(false);
    }
  };

  /** Replaces one order in place, keeping the rest of the table untouched. */
  const patchOrder = (updated: Order | undefined, orderId: number) => {
    if (!updated) return;
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));
  };

  const postOrderAction = async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'That action failed.');
    return data;
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      await postOrderAction({ action: 'updateStatus', orderId, status });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      triggerNotification(`Order #RD-${orderId} status set to "${status}" successfully!`, 'success');
    } catch (err: any) {
      triggerNotification(err.message || 'Error updating order status.', 'error');
    }
  };

  /** Re-asks Paystack about one order and writes back whatever it says. */
  const handleVerifyPayment = async (orderId: number) => {
    setBusyOrderId(orderId);
    try {
      const data = await postOrderAction({ action: 'verifyPayment', orderId });
      patchOrder(data.order, orderId);
      await refreshOrders({ silent: true });
      triggerNotification(`#RD-${orderId}: ${data.message}`, data.outcome === 'paid' ? 'success' : 'error');
    } catch (err: any) {
      triggerNotification(err.message || 'Could not verify that payment.', 'error');
    } finally {
      setBusyOrderId(null);
    }
  };

  /** Confirms money that arrived outside Paystack — cash, transfer, direct MoMo. */
  const handleMarkPaid = async (order: Order) => {
    const note = window.prompt(
      `Mark order #RD-${order.id} (GH₵${Number(order.price).toFixed(2)}) as PAID.\n\n` +
        'Use this only for money received outside Paystack — cash on delivery, a bank transfer, ' +
        'or a direct mobile-money payment.\n\nAdd a short note for the record:',
      'Received directly'
    );
    if (note === null) return;

    setBusyOrderId(order.id);
    try {
      const data = await postOrderAction({
        action: 'markPaid',
        orderId: order.id,
        note,
        channel: 'manual'
      });
      patchOrder(data.order, order.id);
      await refreshOrders({ silent: true });
      triggerNotification(
        `${data.message}${data.smsSent ? ' Customer notified by SMS.' : ''}`,
        'success'
      );
    } catch (err: any) {
      triggerNotification(err.message || 'Could not mark that order as paid.', 'error');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleMarkUnpaid = async (order: Order) => {
    if (
      !window.confirm(
        `Mark order #RD-${order.id} as UNPAID again?\n\nThis clears the recorded payment date and amount. ` +
          'Only do this if the order was confirmed by mistake.'
      )
    ) {
      return;
    }

    setBusyOrderId(order.id);
    try {
      const data = await postOrderAction({ action: 'markUnpaid', orderId: order.id });
      patchOrder(data.order, order.id);
      await refreshOrders({ silent: true });
      triggerNotification(data.message, 'success');
    } catch (err: any) {
      triggerNotification(err.message || 'Could not revert that order.', 'error');
    } finally {
      setBusyOrderId(null);
    }
  };

  /**
   * Walks every unpaid card order and settles it against Paystack. This is the
   * button that recovers a payment whose customer lost connection before the
   * confirmation could reach us.
   */
  const handleReconcilePayments = async () => {
    setIsReconciling(true);
    try {
      const data = await postOrderAction({ action: 'reconcile', limit: 50 });
      if (Array.isArray(data.orders)) setOrders(data.orders);
      if (data.summary) setPaymentSummary(data.summary);
      triggerNotification(data.message, data.reconciliation?.rescued > 0 ? 'success' : 'success');
    } catch (err: any) {
      triggerNotification(err.message || 'Reconciliation failed.', 'error');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleDeleteOrder = async (orderId: number, isPaid: boolean) => {
    const warning = isPaid
      ? `Order #RD-${orderId} has been PAID. Deleting it permanently destroys the only record of that payment.\n\nDelete anyway?`
      : `Are you absolutely sure you want to permanently delete order #RD-${orderId}?`;
    if (!window.confirm(warning)) return;

    try {
      const response = await fetch(
        `/api/admin/orders?orderId=${orderId}${isPaid ? '&force=true' : ''}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (response.ok) {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        triggerNotification(`Order #RD-${orderId} deleted permanently!`, 'success');
      } else {
        throw new Error(data.error || 'Failed to delete order.');
      }
    } catch (err: any) {
      triggerNotification(err.message || 'Error deleting order.', 'error');
    }
  };

  const handlePrintOrder = (order: Order) => {
    const html = buildOrderSlipHtml(order, window.location.origin);
    const printWindow = window.open('', '_blank', 'width=820,height=1000');
    if (!printWindow) {
      triggerNotification('Please allow pop-ups to print the order slip.', 'error');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    // Wait for the document (including the logo image) to finish loading, so the
    // logo is never missing from the printout.
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`Permanently delete "${product.name}" from the product catalog?`)) return;

    if (!isDbConnected) {
      setProducts((prev) => prev.filter((item) => item.id !== product.id));
      triggerNotification('Sandbox Mode: Product deleted from the local catalog.', 'success');
      return;
    }

    try {
      const response = await fetch(`/api/admin/products?productId=${encodeURIComponent(product.id)}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (response.ok) {
        setProducts((prev) => prev.filter((item) => item.id !== product.id));
        triggerNotification('Product deleted successfully from Neon database.', 'success');
      } else {
        throw new Error(data.error || 'Failed to delete product.');
      }
    } catch (err: any) {
      triggerNotification(err.message || 'Error deleting product.', 'error');
    }
  };

  // Sync orders on dashboard mount
  useEffect(() => {
    refreshOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize and Seed Database
  const handleInitDb = async () => {
    setIsInitializing(true);
    try {
      const response = await fetch('/api/admin/init-db', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok) {
        setIsDbConnected(true);
        triggerNotification(data.message || 'Database tables set up and seeded successfully!', 'success');
        
        // Refresh products and drops
        const prodRes = await fetch('/api/admin/products');
        if (prodRes.ok) {
          const freshData = await prodRes.json();
          if (Array.isArray(freshData.products)) setProducts(freshData.products);
        }
        
        const dropRes = await fetch('/api/admin/drops');
        if (dropRes.ok) {
          const freshData = await dropRes.json();
          if (Array.isArray(freshData.drops)) setDrops(freshData.drops);
        }

        const collRes = await fetch('/api/admin/collections');
        if (collRes.ok) {
          const freshData = await collRes.json();
          if (Array.isArray(freshData.collections)) setCollections(freshData.collections);
        }

        const lookRes = await fetch('/api/admin/lookbooks');
        if (lookRes.ok) {
          const freshData = await lookRes.json();
          if (Array.isArray(freshData.lookbooks)) setLookbooks(freshData.lookbooks);
        }
      } else {
        triggerNotification(data.error || 'Failed to initialize database.', 'error');
      }
    } catch (err: any) {
      triggerNotification(err.message || 'An unexpected error occurred.', 'error');
    } finally {
      setIsInitializing(false);
    }
  };

  // Cloudinary File Upload handler
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>, 
    targetField: 'product' | 'drop' | 'collection' | 'lookbook'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImageField(targetField);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (response.ok && data.url) {
        if (targetField === 'product') {
          setProductForm((prev) => ({ ...prev, image: data.url }));
        } else if (targetField === 'drop') {
          setDropForm((prev) => ({ ...prev, image: data.url }));
        } else if (targetField === 'collection') {
          setCollectionForm((prev) => ({ ...prev, image: data.url }));
        } else if (targetField === 'lookbook') {
          setLookbookForm((prev) => ({ ...prev, image: data.url }));
        }
        triggerNotification('Image uploaded successfully to Cloudinary!', 'success');
      } else {
        // Fallback: Read file locally as Base64 to preserve their EXACT selected file!
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          if (targetField === 'product') {
            setProductForm((prev) => ({ ...prev, image: base64data }));
          } else if (targetField === 'drop') {
            setDropForm((prev) => ({ ...prev, image: base64data }));
          } else if (targetField === 'collection') {
            setCollectionForm((prev) => ({ ...prev, image: base64data }));
          } else if (targetField === 'lookbook') {
            setLookbookForm((prev) => ({ ...prev, image: base64data }));
          }
          triggerNotification('Loaded your exact selected image locally!', 'success');
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      // Direct local file backup reader
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        if (targetField === 'product') {
          setProductForm((prev) => ({ ...prev, image: base64data }));
        } else if (targetField === 'drop') {
          setDropForm((prev) => ({ ...prev, image: base64data }));
        } else if (targetField === 'collection') {
          setCollectionForm((prev) => ({ ...prev, image: base64data }));
        } else if (targetField === 'lookbook') {
          setLookbookForm((prev) => ({ ...prev, image: base64data }));
        }
        triggerNotification('Loaded your exact selected image locally!', 'success');
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingImageField(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Cloudinary Variant Image Upload handler
  const handleVariantFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || activeVariantUploadIndex === null) return;

    triggerNotification('Uploading variant image...', 'success');
    const formData = new FormData();
    formData.append('file', file);

    const uploadIndex = activeVariantUploadIndex;

    try {
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (response.ok && data.url) {
        setColorVariants(prev => {
          const next = [...prev];
          next[uploadIndex] = {
            ...next[uploadIndex],
            imageUrls: [...next[uploadIndex].imageUrls, data.url]
          };
          return next;
        });
        triggerNotification('Variant image uploaded successfully!', 'success');
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setColorVariants(prev => {
            const next = [...prev];
            next[uploadIndex] = {
              ...next[uploadIndex],
              imageUrls: [...next[uploadIndex].imageUrls, base64data]
            };
            return next;
          });
          triggerNotification('Loaded your exact variant image locally!', 'success');
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setColorVariants(prev => {
          const next = [...prev];
          next[uploadIndex] = {
            ...next[uploadIndex],
            imageUrls: [...next[uploadIndex].imageUrls, base64data]
          };
          return next;
        });
        triggerNotification('Loaded your exact variant image locally!', 'success');
      };
      reader.readAsDataURL(file);
    } finally {
      setActiveVariantUploadIndex(null);
      if (variantFileInputRef.current) variantFileInputRef.current.value = '';
    }
  };

  const updateColorVariant = (index: number, patch: Partial<AdminColorVariant>) => {
    setColorVariants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const updateVariantSize = (variantIndex: number, sizeIndex: number, patch: Partial<AdminSizeStock>) => {
    setColorVariants((prev) => {
      const next = [...prev];
      const sizes = [...next[variantIndex].sizes];
      sizes[sizeIndex] = { ...sizes[sizeIndex], ...patch };
      next[variantIndex] = { ...next[variantIndex], sizes };
      return next;
    });
  };

  const addSizeToVariant = (variantIndex: number) => {
    setColorVariants((prev) => {
      const next = [...prev];
      next[variantIndex] = {
        ...next[variantIndex],
        sizes: [
          ...next[variantIndex].sizes,
          { size: '', stockStatus: 'in_stock', stockQuantity: '' }
        ]
      };
      return next;
    });
  };

  // Save Product to Neon DB
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-generate slug and ID if empty
    const finalId = productForm.id || 'prod-' + Math.random().toString(36).substring(2, 8);
    const finalSlug = productForm.slug || slugify(productForm.name);

    // Build color lists and images from visual colorVariants
    const finalColors = colorVariants.map(v => v.colorName.trim()).filter(Boolean);
    const finalColorImages: Record<string, string[]> = {};
    colorVariants.forEach(v => {
      if (v.colorName.trim()) {
        finalColorImages[v.colorName.trim()] = v.imageUrls.filter(Boolean);
      }
    });

    const colorHexMap: Record<string, string> = {
      'Obsidian Black': '#090909',
      'Oxide Bone': '#f5f3ee',
      'Signal Red': '#d72638',
      'Graphite': '#2b2c2d'
    };

    const finalColorHex: Record<string, string> = {};
    finalColors.forEach((color) => {
      finalColorHex[color] = colorHexMap[color] || '#555555';
    });

    if (finalColors.length === 0) {
      triggerNotification('Add at least one color/product variant before saving.', 'error');
      return;
    }

    const finalVariants = colorVariants.flatMap((variant) => {
      const color = variant.colorName.trim();
      if (!color) return [];

      return variant.sizes
        .map((sizeRow) => {
          const size = sizeRow.size.trim();
          if (!size) return null;

          if (sizeRow.stockStatus === 'out_of_stock') {
            return {
              id: `${finalId}-${slugify(color)}-${slugify(size)}`,
              size,
              color,
              inventory: 0,
              stockStatus: 'out_of_stock' as const,
              sku: `RD-${finalId.toUpperCase()}-${slugify(color).toUpperCase()}-${size.toUpperCase()}`
            };
          }

          const rawStock = Number(sizeRow.stockQuantity);
          const hasQuantity =
            sizeRow.stockQuantity.trim() !== '' && Number.isFinite(rawStock);
          const parsedStock = hasQuantity ? Math.max(0, Math.floor(rawStock)) : null;
          const stockStatus: AdminStockStatus =
            parsedStock === 0 ? 'out_of_stock' : 'in_stock';

          return {
            id: `${finalId}-${slugify(color)}-${slugify(size)}`,
            size,
            color,
            inventory: stockStatus === 'out_of_stock' ? 0 : parsedStock,
            stockStatus,
            sku: `RD-${finalId.toUpperCase()}-${slugify(color).toUpperCase()}-${size.toUpperCase()}`
          };
        })
        .filter((variant): variant is NonNullable<typeof variant> => Boolean(variant));
    });

    if (finalVariants.length === 0) {
      triggerNotification('Add at least one available size to a color variant before saving.', 'error');
      return;
    }

    const payload: Product = {
      ...productForm,
      id: finalId,
      slug: finalSlug,
      price: Number(productForm.price),
      colors: finalColors,
      colorHex: finalColorHex,
      variants: finalVariants,
      colorImages: finalColorImages,
      details: productForm.details.split('\n').filter(Boolean),
      care: productForm.care.split('\n').filter(Boolean),
      badge: (productForm.badge || undefined) as Product['badge'],
      secondaryImage: finalColorImages[finalColors[0]]?.[0] || productForm.image,
      imageAlt: productForm.name,
      rating: 4.8,
      reviewCount: 24
    };

    if (!isDbConnected) {
      setProducts((prev) => {
        const index = prev.findIndex((p) => p.id === payload.id);
        if (index > -1) {
          const next = [...prev];
          next[index] = payload;
          return next;
        }
        return [payload, ...prev];
      });
      triggerNotification('Sandbox Mode: Saved product successfully in-memory!', 'success');
      setShowProductModal(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.ok) {
        triggerNotification('Product saved successfully to Neon database!', 'success');
        
        setProducts((prev) => {
          const index = prev.findIndex((p) => p.id === payload.id);
          if (index > -1) {
            const next = [...prev];
            next[index] = data.product;
            return next;
          }
          return [data.product, ...prev];
        });
        
        setShowProductModal(false);
      } else {
        triggerNotification(data.error || 'Failed to save product.', 'error');
      }
    } catch (err: any) {
      triggerNotification(err.message || 'An unexpected error occurred.', 'error');
    }
  };

  // Save Drop to Neon DB
  const handleDropSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalSlug = dropForm.slug || dropForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const payload = {
      ...dropForm,
      slug: finalSlug,
      itemCount: Number(dropForm.itemCount) || 0
    };

    if (!isDbConnected) {
      setDrops((prev) => {
        const index = prev.findIndex((d) => d.slug === payload.slug);
        if (index > -1) {
          const next = [...prev];
          next[index] = payload;
          return next;
        }
        return [payload, ...prev];
      });
      triggerNotification('Sandbox Mode: Saved Apparel Drop successfully in-memory!', 'success');
      setShowDropModal(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/drops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.ok) {
        triggerNotification('Apparel Drop saved successfully to Neon database!', 'success');
        
        setDrops((prev) => {
          const index = prev.findIndex((d) => d.slug === payload.slug);
          if (index > -1) {
            const next = [...prev];
            next[index] = data.drop;
            return next;
          }
          return [data.drop, ...prev];
        });

        setShowDropModal(false);
      } else {
        triggerNotification(data.error || 'Failed to save apparel drop.', 'error');
      }
    } catch (err: any) {
      triggerNotification(err.message || 'An unexpected error occurred.', 'error');
    }
  };

  // Save Collection to Neon DB
  const handleCollectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalSlug = collectionForm.slug || collectionForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const parsedProductSlugs = collectionForm.productSlugs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      ...collectionForm,
      slug: finalSlug,
      productSlugs: parsedProductSlugs
    };

    if (!isDbConnected) {
      setCollections((prev) => {
        const index = prev.findIndex((c) => c.slug === payload.slug);
        if (index > -1) {
          const next = [...prev];
          next[index] = payload;
          return next;
        }
        return [payload, ...prev];
      });
      triggerNotification('Sandbox Mode: Saved Collection successfully in-memory!', 'success');
      setShowCollectionModal(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.ok) {
        triggerNotification('Collection saved successfully to Neon database!', 'success');

        setCollections((prev) => {
          const index = prev.findIndex((c) => c.slug === payload.slug);
          if (index > -1) {
            const next = [...prev];
            next[index] = data.collection;
            return next;
          }
          return [data.collection, ...prev];
        });

        setShowCollectionModal(false);
      } else {
        triggerNotification(data.error || 'Failed to save collection.', 'error');
      }
    } catch (err: any) {
      triggerNotification(err.message || 'An unexpected error occurred.', 'error');
    }
  };

  // Save Lookbook to Neon DB
  const handleLookbookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalSlug = lookbookForm.slug || lookbookForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const parsedProductSlugs = lookbookForm.featuredProductSlugs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      ...lookbookForm,
      slug: finalSlug,
      featuredProductSlugs: parsedProductSlugs
    };

    if (!isDbConnected) {
      setLookbooks((prev) => {
        const index = prev.findIndex((l) => l.slug === payload.slug);
        if (index > -1) {
          const next = [...prev];
          next[index] = payload;
          return next;
        }
        return [payload, ...prev];
      });
      triggerNotification('Sandbox Mode: Saved Lookbook campaign successfully in-memory!', 'success');
      setShowLookbookModal(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/lookbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.ok) {
        triggerNotification('Lookbook campaign saved successfully to Neon database!', 'success');

        setLookbooks((prev) => {
          const index = prev.findIndex((l) => l.slug === payload.slug);
          if (index > -1) {
            const next = [...prev];
            next[index] = data.lookbook;
            return next;
          }
          return [data.lookbook, ...prev];
        });

        setShowLookbookModal(false);
      } else {
        triggerNotification(data.error || 'Failed to save lookbook campaign.', 'error');
      }
    } catch (err: any) {
      triggerNotification(err.message || 'An unexpected error occurred.', 'error');
    }
  };

  // Pre-fill Product Form for Editing
  const openEditProduct = (p: Product) => {
    setProductForm({
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: String(p.price),
      category: p.category,
      collectionSlug: p.collectionSlug,
      collectionName: p.collectionName,
      badge: p.badge || '',
      image: p.image,
      description: p.description,
      story: p.story,
      material: p.material,
      fit: p.fit,
      colors: p.colors.join(', '),
      colorImagesStr: p.colorImages ? Object.entries(p.colorImages).map(([color, urls]) => `${color}: ${urls.join(', ')}`).join('\n') : '',
      sizes: Array.from(new Set(p.variants.map((v) => v.size))).join(', ') || 'S, M, L, XL, XXL',
      details: p.details.join('\n'),
      care: p.care.join('\n')
    });

    const variantsList = p.colors.map((color) => {
      const sizeRows = p.variants
        .filter((variant) => variant.color === color)
        .map((variant) => ({
          size: variant.size,
          stockStatus: (variant.stockStatus === 'out_of_stock' || variant.inventory === 0
            ? 'out_of_stock'
            : 'in_stock') as AdminStockStatus,
          stockQuantity:
            typeof variant.inventory === 'number' && Number.isFinite(variant.inventory) && variant.inventory > 0
              ? String(variant.inventory)
              : ''
        }));

      return {
        colorName: color,
        imageUrls: p.colorImages?.[color] || [],
        sizes: sizeRows.length > 0 ? sizeRows : createSizeRows()
      };
    });
    setColorVariants(variantsList);

    setShowProductModal(true);
  };

  // Pre-fill Drop Form for Editing
  const openEditDrop = (d: Drop) => {
    setDropForm({
      slug: d.slug,
      name: d.name,
      status: d.status,
      releaseDate: d.releaseDate.substring(0, 16),
      itemCount: String(d.itemCount),
      summary: d.summary,
      image: d.image
    });
    setShowDropModal(true);
  };

  // Pre-fill Collection Form for Editing
  const openEditCollection = (c: Collection) => {
    setCollectionForm({
      slug: c.slug,
      name: c.name,
      tagline: c.tagline,
      description: c.description,
      image: c.image,
      productSlugs: c.productSlugs.join(', ')
    });
    setShowCollectionModal(true);
  };

  // Pre-fill Lookbook Form for Editing
  const openEditLookbook = (l: LookbookIssue) => {
    setLookbookForm({
      slug: l.slug,
      title: l.title,
      season: l.season,
      dek: l.dek,
      image: l.image,
      featuredProductSlugs: l.featuredProductSlugs.join(', ')
    });
    setShowLookbookModal(true);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/admin/logout', {
        method: 'POST'
      });
      if (response.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className={styles.adminContainer}>
      <header className={styles.adminHeader}>
        <div>
          <p className={styles.adminSubtitle}>Management Console</p>
          <h1 className={styles.adminTitle}>REDOXDESIGNX Admin</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {isDbConnected && (
            <button 
              className={styles.initButton}
              onClick={handleInitDb}
              disabled={isInitializing}
            >
              {isInitializing ? 'Re-seeding...' : 'Reset & Seed DB'}
            </button>
          )}
          <button 
            onClick={handleLogout}
            style={{
              background: 'transparent',
              color: '#888',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '6px 16px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontFamily: 'var(--font-mono), monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {notification && (
        <div className={`${styles.notification} ${notification.type === 'success' ? styles.notificationSuccess : styles.notificationError}`}>
          <span className={styles.dot}></span>
          <p>{notification.message}</p>
        </div>
      )}

      {/* Integration Status Indicator Panel */}
      <section className={styles.statusCard}>
        <h2 className={styles.statusTitle}>External Services Integration</h2>
        <div className={styles.statusGrid}>
          {/* Neon DB Status */}
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Neon Postgres DB Connection</span>
            <div className={`${styles.statusBadge} ${isDbConnected ? styles.statusBadgeConnected : styles.statusBadgeMissing}`}>
              <span className={styles.dot}></span>
              {isDbConnected ? 'Connected' : 'Missing URL'}
            </div>
          </div>
          
          {/* Cloudinary Status */}
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Cloudinary Image Hosting</span>
            <div className={`${styles.statusBadge} ${initialCloudinaryStatus ? styles.statusBadgeConnected : styles.statusBadgeMissing}`}>
              <span className={styles.dot}></span>
              {initialCloudinaryStatus ? 'Ready' : 'Missing Credentials'}
            </div>
          </div>
        </div>

        {!isDbConnected && (
          <div style={{ marginTop: 'var(--space-5)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 'var(--space-4)' }}>
            <p style={{ color: '#aaa', fontSize: '0.85rem', margin: '0 0 var(--space-3) 0', lineHeight: '1.4' }}>
              <strong>Setup Needed:</strong> Paste your Neon Postgres connection string as <code>DATABASE_URL</code> in your local <code>.env</code> file. Once configured, click the Setup button to automatically initialize your database tables and seed the apparel catalog live!
            </p>
            <button 
              className={styles.initButton} 
              onClick={handleInitDb}
              disabled={isInitializing}
            >
              {isInitializing ? 'Initializing Tables...' : 'Initialize & Seed Database Now'}
            </button>
          </div>
        )}
      </section>

      {/* Hidden file input for Cloudinary upload */}
      <input 
        type="file" 
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={(e) => {
          const field = uploadingImageField;
          if (field) handleFileUpload(e, field);
        }}
      />

      {/* Hidden file input for variant uploads */}
      <input 
        type="file" 
        ref={variantFileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleVariantFileUpload}
      />

      {/* Tabs Layout */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'products' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Products ({products.length})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'orders' ? styles.activeTab : ''}`}
          onClick={() => {
            setActiveTab('orders');
            refreshOrders();
          }}
        >
          Customer Orders ({orders.length})
        </button>
      </div>

      {/* Products Tab View */}
      {activeTab === 'products' && (
        <div>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Product Catalog</h2>
            <button 
              className={styles.saveButton}
              onClick={() => {
                setProductForm({
                  id: '',
                  slug: '',
                  name: '',
                  price: '',
                  category: '',
                  collectionSlug: '',
                  collectionName: '',
                  badge: '',
                  image: '',
                  description: '',
                  story: '',
                  material: '100% compact cotton',
                  fit: 'Boxy fit, true to size',
                  colors: 'Obsidian Black, Oxide Bone',
                  colorImagesStr: '',
                  sizes: 'S, M, L, XL, XXL',
                  details: '240GSM compact cotton jersey\nBoxy shoulder\nTwin needle hem',
                  care: 'Machine wash cold\nHang dry\nIron low'
                });
                setColorVariants([
                  { colorName: 'Obsidian Black', imageUrls: [], sizes: createSizeRows() },
                  { colorName: 'Oxide Bone', imageUrls: [], sizes: createSizeRows() }
                ]);
                setShowProductModal(true);
              }}
            >
              + Create Product
            </button>
          </div>

          <div className={styles.grid}>
            {products.map((p) => {
              const stock = getProductStockSummary(p);

              return (
              <article className={styles.card} key={p.id}>
                {p.badge && <span className={styles.cardBadge}>{p.badge}</span>}
                <div className={styles.cardImageContainer}>
                  <Image 
                    src={p.image} 
                    alt={p.imageAlt || p.name} 
                    fill 
                    className={styles.cardImage} 
                    sizes="(min-width: 900px) 25vw, 50vw"
                  />
                </div>
                <div className={styles.cardContent}>
                  <p className={styles.cardCategory}>{p.category} / {p.collectionName}</p>
                  <h3 className={styles.cardTitle}>{p.name}</h3>
                  <div className={styles.stockPills}>
                    <span className={stock.isSoldOut ? styles.stockPillDanger : styles.stockPill}>
                      {stock.isSoldOut ? 'Out of stock' : 'In stock'}
                    </span>
                    <span className={styles.stockPill}>{p.variants.length} size variants</span>
                    {!stock.isSoldOut && !stock.hasUnlimitedStock && stock.totalKnownStock > 0 && (
                      <span className={styles.stockPill}>{stock.totalKnownStock} pieces</span>
                    )}
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.cardPrice}>{formatCurrency(p.price)}</span>
                    <a
                      className={styles.editButton}
                      href={`/products/${p.slug}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      View live
                    </a>
                    <button className={styles.editButton} onClick={() => openEditProduct(p)}>
                      Edit / Update
                    </button>
                    <button className={styles.dangerButton} onClick={() => handleDeleteProduct(p)}>
                      Delete
                    </button>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        </div>
      )}



      {/* Customer Orders Tab View */}
      {activeTab === 'orders' && (
        <div>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Customer Placed Orders (Direct Checkout)</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className={styles.saveButton}
                onClick={handleReconcilePayments}
                disabled={isReconciling}
                title="Ask Paystack about every order that has not been confirmed as paid, and settle it."
              >
                {isReconciling ? 'Checking Paystack…' : '⟳ Verify all pending payments'}
              </button>
              <button
                className={styles.saveButton}
                onClick={() => refreshOrders()}
                disabled={isRefreshingOrders}
              >
                {isRefreshingOrders ? 'Syncing...' : '↻ Sync orders'}
              </button>
            </div>
          </div>

          {/* Money at a glance. `needsAttention` is the number that matters:
              paid-for orders that have not been confirmed yet would once have
              been lost entirely. */}
          {paymentSummary && paymentSummary.total > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '10px',
                marginBottom: 'var(--space-4)'
              }}
            >
              {[
                { label: 'Confirmed paid', value: String(paymentSummary.paid), sub: `GH₵${paymentSummary.paidRevenue.toFixed(2)} received`, color: '#10b981' },
                { label: 'Awaiting payment', value: String(paymentSummary.unpaid), sub: `GH₵${paymentSummary.unpaidValue.toFixed(2)} outstanding`, color: '#f59e0b' },
                { label: 'Needs checking', value: String(paymentSummary.needsAttention), sub: 'Unpaid card orders over 1h old', color: paymentSummary.needsAttention > 0 ? '#ef4444' : '#666' },
                { label: 'Failed / abandoned', value: String(paymentSummary.failed + paymentSummary.abandoned), sub: 'No money received', color: '#9ca3af' }
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    background: '#0a0a0a',
                    border: `1px solid ${card.color}33`,
                    borderRadius: '6px',
                    padding: 'var(--space-3) var(--space-4)'
                  }}
                >
                  <div style={{ color: '#777', fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    {card.label}
                  </div>
                  <div style={{ color: card.color, fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', marginTop: '4px' }}>
                    {card.value}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.68rem', marginTop: '2px' }}>{card.sub}</div>
                </div>
              ))}
            </div>
          )}

          {paymentSummary && paymentSummary.needsAttention > 0 && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.28)',
                borderRadius: '6px',
                padding: 'var(--space-3) var(--space-4)',
                marginBottom: 'var(--space-4)',
                color: '#ff9aa4',
                fontSize: '0.8rem',
                lineHeight: 1.55
              }}
            >
              <strong>{paymentSummary.needsAttention} card order(s)</strong> have been sitting unpaid for over an
              hour. Press <strong>Verify all pending payments</strong> above — any customer who was charged but
              lost connection will be confirmed automatically.
            </div>
          )}

          {orders.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
              {([
                ['all', `All (${orders.length})`],
                ['paid', `Paid (${orders.filter((o) => o.paymentStatus === 'paid').length})`],
                ['unpaid', `Unpaid (${orders.filter((o) => o.paymentStatus === 'unpaid').length})`],
                ['attention', `Needs checking (${orders.filter(needsAttention).length})`],
                ['failed', `Failed (${orders.filter((o) => o.paymentStatus === 'failed' || o.paymentStatus === 'abandoned').length})`]
              ] as [PaymentFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPaymentFilter(key)}
                  style={{
                    background: paymentFilter === key ? '#fff' : 'transparent',
                    color: paymentFilter === key ? '#000' : '#888',
                    border: '1px solid rgba(255,255,255,0.12)',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {orders.length === 0 ? (
            <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center', background: '#090909', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '4px' }}>
              <p style={{ color: '#888', fontSize: '0.9rem' }}>
                Zero customer orders parsed yet. Customer direct checkout orders placed on the product pages will appear here live!
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', background: '#080808', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#111', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Order ID</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Customer Info</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Items Ordered</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Qty</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Price</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Shipping Destination</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600, minWidth: '230px' }}>Payment</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Order Status</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Date Placed</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.filter((o) => matchesPaymentFilter(o, paymentFilter)).map((o) => (
                    <tr
                      key={o.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        // An unpaid card order left hanging gets a red rail down
                        // its left edge so it cannot be missed while scanning.
                        borderLeft: needsAttention(o) ? '3px solid #ef4444' : '3px solid transparent',
                        background: o.paymentStatus === 'paid' ? 'transparent' : 'rgba(245, 158, 11, 0.03)',
                        opacity: busyOrderId === o.id ? 0.55 : 1,
                        transition: 'opacity 0.15s'
                      }}
                    >
                      <td style={{ padding: 'var(--space-3)', color: '#555' }}>#RD-{o.id}</td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <div style={{ fontWeight: 'bold', color: '#fff' }}>{o.customerName}</div>
                        <div style={{ color: '#aaa', fontSize: '0.75rem' }}>{o.customerPhone}</div>
                        <div style={{ color: '#777', fontSize: '0.7rem' }}>{o.customerEmail}</div>
                      </td>
                      <td style={{ padding: 'var(--space-3)', minWidth: '260px' }}>
                        <div style={{ display: 'grid', gap: '6px' }}>
                          {o.items.map((item, index) => (
                            <div key={`${item.productSlug}-${item.color}-${item.size}-${index}`}>
                              <div style={{ color: '#10b981', fontWeight: 'bold' }}>{item.productName}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                                <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '3px' }}>
                                  {item.color}
                                </span>
                                <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 6px', borderRadius: '3px' }}>
                                  {item.size}
                                </span>
                                <span style={{ background: 'rgba(215,38,56,0.18)', color: '#ff6b7a', padding: '2px 6px', borderRadius: '3px', fontWeight: 'bold' }}>
                                  &times;{item.quantity}
                                </span>
                                <span style={{ color: '#777', fontSize: '0.75rem' }}>
                                  @ GH₵{item.unitPrice} = GH₵{item.lineTotal.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-3)', color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>
                        {o.totalQuantity}
                      </td>
                      <td style={{ padding: 'var(--space-3)', color: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        GH₵{o.price.toFixed(2)}
                        <div style={{ color: '#666', fontSize: '0.7rem', fontWeight: 'normal', marginTop: '2px' }}>
                          sub GH₵{o.subtotal.toFixed(2)} + fee GH₵{o.serviceCharge.toFixed(2)}
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <div style={{ color: '#f5f3ee' }}>{o.shippingAddress}</div>
                        <div style={{ color: '#888', fontSize: '0.75rem' }}>{o.shippingCity}</div>
                      </td>
                      <td style={{ padding: 'var(--space-3)', verticalAlign: 'top' }}>
                        {(() => {
                          const badge = paymentBadge(o);
                          const reference = o.paymentReference || o.momoNumber;
                          const busy = busyOrderId === o.id;

                          return (
                            <div style={{ display: 'grid', gap: '6px' }}>
                              <span
                                style={{
                                  background: badge.background,
                                  color: badge.color,
                                  border: `1px solid ${badge.color}66`,
                                  padding: '4px 9px',
                                  borderRadius: '4px',
                                  fontWeight: 'bold',
                                  fontSize: '0.72rem',
                                  letterSpacing: '0.06em',
                                  justifySelf: 'start'
                                }}
                              >
                                {badge.label}
                              </span>

                              <div style={{ color: '#999', fontSize: '0.7rem', lineHeight: 1.6 }}>
                                <div>
                                  {o.paymentMethod === 'PAYSTACK'
                                    ? `Paystack${o.paymentChannel ? ` · ${formatChannel(o.paymentChannel)}` : ''}`
                                    : o.paymentMethod === 'COD'
                                    ? 'Cash on delivery'
                                    : `Mobile money${o.momoNetwork ? ` · ${o.momoNetwork}` : ''}`}
                                </div>

                                {o.paymentStatus === 'paid' && (
                                  <div style={{ color: '#10b981' }}>
                                    GH₵{Number(o.amountPaid ?? o.price).toFixed(2)} received
                                    {o.paidAt ? ` · ${new Date(o.paidAt).toLocaleString()}` : ''}
                                  </div>
                                )}

                                {reference && (
                                  <div
                                    onClick={() => {
                                      navigator.clipboard?.writeText(reference);
                                      triggerNotification('Payment reference copied.', 'success');
                                    }}
                                    style={{ color: '#777', cursor: 'copy', wordBreak: 'break-all' }}
                                    title="Click to copy — search this on your Paystack dashboard"
                                  >
                                    Ref: {reference}
                                  </div>
                                )}

                                {o.paymentVerifiedBy && (
                                  <div style={{ color: '#555', fontSize: '0.66rem' }}>
                                    Confirmed by: {o.paymentVerifiedBy}
                                    {o.lastVerifiedAt ? ` · checked ${new Date(o.lastVerifiedAt).toLocaleString()}` : ''}
                                  </div>
                                )}

                                {o.gatewayResponse && o.paymentStatus !== 'paid' && (
                                  <div style={{ color: '#ff8a94', fontSize: '0.66rem' }}>{o.gatewayResponse}</div>
                                )}

                                {o.paymentNote && (
                                  <div style={{ color: '#a78bfa', fontSize: '0.66rem' }}>Note: {o.paymentNote}</div>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '2px' }}>
                                {o.paymentMethod === 'PAYSTACK' && (
                                  <button
                                    onClick={() => handleVerifyPayment(o.id)}
                                    disabled={busy}
                                    title="Ask Paystack directly whether this transaction was paid, and update the order."
                                    style={{
                                      background: 'rgba(59, 130, 246, 0.15)',
                                      color: '#60a5fa',
                                      border: '1px solid rgba(59, 130, 246, 0.35)',
                                      padding: '4px 8px',
                                      fontSize: '0.66rem',
                                      borderRadius: '4px',
                                      cursor: busy ? 'wait' : 'pointer',
                                      fontWeight: 'bold',
                                      fontFamily: 'var(--font-mono), monospace',
                                      whiteSpace: 'nowrap'
                                    }}
                                    type="button"
                                  >
                                    {busy ? '…' : '⟳ Check Paystack'}
                                  </button>
                                )}

                                {o.paymentStatus !== 'paid' ? (
                                  <button
                                    onClick={() => handleMarkPaid(o)}
                                    disabled={busy}
                                    title="Record money received outside Paystack (cash, transfer, direct MoMo)."
                                    style={{
                                      background: 'rgba(16, 185, 129, 0.15)',
                                      color: '#10b981',
                                      border: '1px solid rgba(16, 185, 129, 0.35)',
                                      padding: '4px 8px',
                                      fontSize: '0.66rem',
                                      borderRadius: '4px',
                                      cursor: busy ? 'wait' : 'pointer',
                                      fontWeight: 'bold',
                                      fontFamily: 'var(--font-mono), monospace',
                                      whiteSpace: 'nowrap'
                                    }}
                                    type="button"
                                  >
                                    ✓ Mark paid
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleMarkUnpaid(o)}
                                    disabled={busy}
                                    title="Undo a payment confirmation made in error."
                                    style={{
                                      background: 'transparent',
                                      color: '#777',
                                      border: '1px solid rgba(255,255,255,0.14)',
                                      padding: '4px 8px',
                                      fontSize: '0.66rem',
                                      borderRadius: '4px',
                                      cursor: busy ? 'wait' : 'pointer',
                                      fontFamily: 'var(--font-mono), monospace',
                                      whiteSpace: 'nowrap'
                                    }}
                                    type="button"
                                  >
                                    Undo paid
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <select
                          value={o.status || 'Pending'}
                          onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                          style={{
                            background: o.status === 'Pending' ? 'rgba(245, 158, 11, 0.15)' :
                                        o.status === 'Processing' ? 'rgba(59, 130, 246, 0.15)' :
                                        o.status === 'Shipped' ? 'rgba(139, 92, 246, 0.15)' :
                                        o.status === 'Delivered' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: o.status === 'Pending' ? '#f59e0b' :
                                   o.status === 'Processing' ? '#3b82f6' :
                                   o.status === 'Shipped' ? '#8b5cf6' :
                                   o.status === 'Delivered' ? '#10b981' : '#ef4444',
                            border: '1px solid currentColor',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="Awaiting Payment" style={{ background: '#111', color: '#f59e0b' }}>Awaiting Payment</option>
                          <option value="Pending" style={{ background: '#111', color: '#f59e0b' }}>Pending</option>
                          <option value="Processing" style={{ background: '#111', color: '#3b82f6' }}>Processing</option>
                          <option value="Shipped" style={{ background: '#111', color: '#8b5cf6' }}>Shipped</option>
                          <option value="Delivered" style={{ background: '#111', color: '#10b981' }}>Delivered</option>
                          <option value="Cancelled" style={{ background: '#111', color: '#ef4444' }}>Cancelled</option>
                          <option value="Payment Failed" style={{ background: '#111', color: '#ef4444' }}>Payment Failed</option>
                        </select>

                        {/* Fulfilment and money are separate states: shipping an
                            unpaid order is a decision, never an accident. */}
                        {o.paymentStatus !== 'paid' &&
                          ['Processing', 'Shipped', 'Delivered'].includes(o.status) && (
                            <div style={{ color: '#ef4444', fontSize: '0.65rem', marginTop: '6px', maxWidth: '130px', lineHeight: 1.4 }}>
                              ⚠ Being fulfilled while unpaid
                            </div>
                          )}
                      </td>
                      <td style={{ padding: 'var(--space-3)', color: '#777' }}>{new Date(o.createdAt).toLocaleString()}</td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button
                            onClick={() => handlePrintOrder(o)}
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontFamily: 'var(--font-mono), monospace',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            ⎙ Print
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(o.id, o.paymentStatus === 'paid')}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontFamily: 'var(--font-mono), monospace',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Product Creation / Edition Modal */}
      {showProductModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{productForm.id ? 'Modify Product' : 'Add New Product'}</h3>
              <button className={styles.closeButton} onClick={() => setShowProductModal(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleProductSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                {/* Product Name */}
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Product Name *</label>
                  <input 
                    type="text" 
                    required 
                    className={styles.input}
                    placeholder="e.g. Cobalt Utility Vest"
                    value={productForm.name}
                    onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>

                {/* Price */}
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Price (GH₵ GHS) *</label>
                  <input 
                    type="number" 
                    required 
                    className={styles.input}
                    placeholder="128"
                    value={productForm.price}
                    onChange={(e) => setProductForm((p) => ({ ...p, price: e.target.value }))}
                  />
                </div>

                {/* Product Unique ID */}
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Unique ID (SKU base)</label>
                  <input 
                    type="text" 
                    className={styles.input}
                    placeholder="e.g. jkt-002 (Leave blank for automatic)"
                    disabled={Boolean(productForm.id)}
                    value={productForm.id}
                    onChange={(e) => setProductForm((p) => ({ ...p, id: e.target.value }))}
                  />
                </div>

                {/* Slug */}
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>URL Slug</label>
                  <input 
                    type="text" 
                    className={styles.input}
                    placeholder="e.g. cobalt-utility-vest (Automatic if blank)"
                    value={productForm.slug}
                    onChange={(e) => setProductForm((p) => ({ ...p, slug: e.target.value }))}
                  />
                </div>

                {/* Category */}
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Product Category *</label>
                  <input 
                    type="text" 
                    required 
                    className={styles.input}
                    placeholder="e.g. Hoodies, Tops, Accessories..."
                    value={productForm.category}
                    onChange={(e) => setProductForm((p) => ({ ...p, category: e.target.value }))}
                  />
                </div>



                {/* Image Upload Widget */}
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.fieldLabel}>Product Display Image *</label>
                  {productForm.image ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <div className={styles.uploadedPreview}>
                        <Image 
                          src={productForm.image} 
                          alt="Product preview" 
                          fill 
                          className={styles.previewImage} 
                        />
                        <button 
                          type="button" 
                          className={styles.removeImage}
                          onClick={() => setProductForm((p) => ({ ...p, image: '' }))}
                        >
                          &times;
                        </button>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#10b981', marginTop: 'var(--space-1)', fontFamily: 'monospace' }}>
                        Linked to Cloudinary image safely!
                      </p>
                    </div>
                  ) : (
                    <div 
                      className={styles.uploadArea}
                      onClick={() => {
                        setUploadingImageField('product');
                        fileInputRef.current?.click();
                      }}
                    >
                      <span className={styles.uploadIcon}>☁</span>
                      <span className={styles.uploadText}>
                        {uploadingImageField === 'product' ? 'Securely Uploading to Cloudinary...' : 'Click to Upload Image to Cloudinary'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Default Sizes */}
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Default Sizes for New Color Variants</label>
                  <input 
                    type="text" 
                    className={styles.input}
                    placeholder="S, M, L, XL, XXL"
                    value={productForm.sizes}
                    onChange={(e) => setProductForm((p) => ({ ...p, sizes: e.target.value }))}
                  />
                </div>

                {/* Dynamic Product Color Variants (By Images) */}
                <div className={`${styles.field} ${styles.formGridFull}`} style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-5)', marginTop: 'var(--space-3)' }}>
                  <label className={styles.fieldLabel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff' }}>Product Color Variants (By Images) *</span>
                    <button
                      type="button"
                      className={styles.saveButton}
                      style={{ height: '32px', padding: '0 var(--space-3)', fontSize: '0.75rem', margin: 0 }}
                      onClick={() => {
                        const baseSizes = productForm.sizes.split(',').map((size) => size.trim()).filter(Boolean);
                        setColorVariants(prev => [...prev, { colorName: 'New Color', imageUrls: [], sizes: createSizeRows(baseSizes.length ? baseSizes : undefined) }]);
                      }}
                    >
                      + Add Color Image Variant
                    </button>
                  </label>
                  
                  {colorVariants.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-6)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', color: '#666', fontSize: '0.8rem' }}>
                      No color variants added yet. Click &quot;+ Add Color Image Variant&quot; to start!
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                      {colorVariants.map((variant, index) => (
                        <div 
                          key={index} 
                          style={{ 
                            background: 'var(--color-surface)', 
                            border: '1px solid var(--color-border)', 
                            borderRadius: 'var(--radius-md)', 
                            padding: 'var(--space-4)',
                            display: 'grid',
                            gap: 'var(--space-3)'
                          }}
                        >
                          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ flex: 1, display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#aaa' }}>#{index + 1} Color:</span>
                              <input 
                                type="text"
                                required
                                placeholder="e.g. Midnight Black, Pearl White..."
                                className={styles.input}
                                style={{ height: '36px', maxWidth: '240px', margin: 0 }}
                                value={variant.colorName}
                                onChange={(e) => {
                                  setColorVariants(prev => {
                                    const next = [...prev];
                                    next[index] = { ...next[index], colorName: e.target.value };
                                    return next;
                                  });
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              style={{ 
                                background: 'rgba(239, 68, 68, 0.1)', 
                                color: '#ef4444', 
                                border: '1px solid rgba(239, 68, 68, 0.2)', 
                                padding: '4px 10px', 
                                fontSize: '0.75rem', 
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                              onClick={() => setColorVariants(prev => prev.filter((_, i) => i !== index))}
                            >
                              Remove Variant
                            </button>
                          </div>

                          <div className={styles.variantInventory}>
                            <div className={styles.variantInventoryHeader}>
                              <div>
                                <strong>Sizes for {variant.colorName || `variant ${index + 1}`}</strong>
                                <span>
                                  Only these sizes appear when this color is selected. Qty is optional — leave blank for open stock, or enter a number to track pieces.
                                </span>
                              </div>
                              <button type="button" className={styles.editButton} onClick={() => addSizeToVariant(index)}>
                                + Add Size
                              </button>
                            </div>

                            <div className={styles.sizeRows}>
                              {variant.sizes.map((sizeRow, sizeIndex) => (
                                <div className={styles.sizeRow} key={`${index}-${sizeIndex}`}>
                                  <input
                                    aria-label="Size name"
                                    className={styles.input}
                                    placeholder="Size"
                                    required
                                    value={sizeRow.size}
                                    onChange={(e) => updateVariantSize(index, sizeIndex, { size: e.target.value })}
                                  />
                                  <select
                                    aria-label="Stock status"
                                    className={styles.select}
                                    value={sizeRow.stockStatus}
                                    onChange={(e) => updateVariantSize(index, sizeIndex, { stockStatus: e.target.value as AdminStockStatus })}
                                  >
                                    <option value="in_stock">In stock</option>
                                    <option value="out_of_stock">Out of stock</option>
                                  </select>
                                  <input
                                    aria-label="Optional stock amount"
                                    className={styles.input}
                                    min="0"
                                    placeholder="Qty optional"
                                    type="number"
                                    value={sizeRow.stockQuantity}
                                    onChange={(e) => updateVariantSize(index, sizeIndex, { stockQuantity: e.target.value })}
                                  />
                                  <button
                                    type="button"
                                    className={styles.dangerButton}
                                    onClick={() => updateColorVariant(index, {
                                      sizes: variant.sizes.filter((_, i) => i !== sizeIndex)
                                    })}
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Images grid for this variant */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
                            {variant.imageUrls.map((url, imgIndex) => (
                              <div 
                                key={imgIndex} 
                                style={{ 
                                  position: 'relative', 
                                  width: '64px', 
                                  height: '64px', 
                                  borderRadius: 'var(--radius-sm)', 
                                  overflow: 'hidden', 
                                  border: '1px solid var(--color-border)' 
                                }}
                              >
                                <img src={url} alt={variant.colorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button
                                  type="button"
                                  style={{
                                    position: 'absolute',
                                    top: 2,
                                    right: 2,
                                    background: 'rgba(0,0,0,0.7)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '16px',
                                    height: '16px',
                                    fontSize: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => {
                                    setColorVariants(prev => {
                                      const next = [...prev];
                                      next[index] = {
                                        ...next[index],
                                        imageUrls: next[index].imageUrls.filter((_, i) => i !== imgIndex)
                                      };
                                      return next;
                                    });
                                  }}
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                            
                            {/* Upload button for this specific variant */}
                            <div
                              className={styles.uploadArea}
                              style={{ 
                                width: '64px', 
                                height: '64px', 
                                padding: 0, 
                                display: 'flex', 
                                flexDirection: 'column', 
                                justifyContent: 'center', 
                                alignItems: 'center',
                                margin: 0,
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                setActiveVariantUploadIndex(index);
                                variantFileInputRef.current?.click();
                              }}
                            >
                              <span style={{ fontSize: '1rem', color: '#888' }}>☁</span>
                              <span style={{ fontSize: '9px', color: '#666', marginTop: 2 }}>Upload</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>


                {/* Description */}
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.fieldLabel}>Short Overview Description</label>
                  <textarea 
                    className={styles.textarea}
                    placeholder="A boxy, heavy utility piece styled for daily wear..."
                    value={productForm.description}
                    onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>

                {/* Materials & Fit */}
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.fieldLabel}>Material Composition</label>
                  <input 
                    type="text" 
                    className={styles.input}
                    value={productForm.material}
                    onChange={(e) => setProductForm((p) => ({ ...p, material: e.target.value }))}
                  />
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.cancelButton} onClick={() => setShowProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveButton} disabled={!productForm.image}>
                  {isDbConnected ? (productForm.id ? 'Save Live' : 'Create Live') : (productForm.id ? 'Update Sandbox' : 'Create Sandbox')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
