'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import type { Product, Drop, Collection, LookbookIssue, Order } from '@/types/product';
import type { OrderPaymentSummary } from '@/lib/order-receipt';
import type { WaitlistSignup } from '@/lib/catalog-db';
import { formatCurrency } from '@/lib/format';
import { getProductStockSummary } from '@/lib/inventory';
import { sumOrderExtras } from '@/lib/order-schema';
import { CreateOrderModal, type CreatedOrderResult } from './CreateOrderModal';
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

export type PaymentFilter = 'all' | 'paid' | 'unpaid' | 'attention' | 'failed' | 'instore';

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
    case 'instore':
      return order.source === 'admin';
    default:
      return true;
  }
}

function formatChannel(channel?: string): string {
  if (!channel) return '';
  return channel.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * How the money was taken, in plain words. Manual orders introduced values the
 * original three-way check did not know about, and an unlabelled method reads as
 * a bug to whoever is scanning the table.
 */
function paymentMethodLabel(order: Order): string {
  switch (order.paymentMethod) {
    case 'PAYSTACK':
      return `Paystack${order.paymentChannel ? ` · ${formatChannel(order.paymentChannel)}` : ''}`;
    case 'COD':
      return 'Cash on delivery';
    case 'CASH':
      return 'Cash (in person)';
    case 'BANK':
      return 'Bank transfer';
    case 'MOMO':
      return `Mobile money${order.momoNetwork ? ` · ${order.momoNetwork}` : ''}`;
    default:
      return order.paymentMethod || 'Unknown';
  }
}

/** Build a self-contained, white, print-ready order slip for a single order. */
function buildOrderSlipHtml(order: Order, origin: string): string {
  const ref = `#RD-${order.id}`;
  const logoSrc = `${origin}/assets/icons/redoxlogo.jpg`;

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
  .total {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 16px; padding: 11px 12px; background: #111; border-radius: 5px;
  }
  .total .k { font-size: 8.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #bbb; }
  .total .v { font-size: 19px; font-weight: 800; color: #fff; }
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

    ${
      order.extras.length > 0 || order.discount > 0
        ? `<div class="gap">
      <div class="section-title">Breakdown</div>
      <div class="field">
        <div class="l">Items</div>
        <div class="d">${ghs(order.subtotal)}</div>
      </div>
      ${order.extras
        .map(
          (extra) => `<div class="field">
        <div class="l">${escapeHtml(extra.label)}</div>
        <div class="d">${ghs(extra.amount)}</div>
      </div>`
        )
        .join('')}
      ${
        order.discount > 0
          ? `<div class="field">
        <div class="l">Discount</div>
        <div class="d">- ${ghs(order.discount)}</div>
      </div>`
          : ''
      }
    </div>`
        : ''
    }

    <div class="total">
      <span class="k">Total Amount</span>
      <span class="v">${ghs(order.price)}</span>
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
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('paid');
  const [isDbConnected, setIsDbConnected] = useState(initialDbStatus);

  // Database Initializing State
  const [isInitializing, setIsInitializing] = useState(false);
  const [isRefreshingWaitlist, setIsRefreshingWaitlist] = useState(false);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  /** The order whose payment action is in flight, so its row can show progress. */
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  
  // Form Modal States
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  /** Newly created order, briefly highlighted in the table so it is easy to find. */
  const [highlightOrderId, setHighlightOrderId] = useState<number | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showDropModal, setShowDropModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showLookbookModal, setShowLookbookModal] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  
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
    visibility: 'visible' as 'visible' | 'hidden',
    wholesaleEnabled: false,
    wholesaleMinQuantity: '',
    wholesalePrice: '',
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

  /**
   * Folds a hand-written order into the table the moment it exists, so the
   * merchant sees it land rather than having to trust that it did.
   */
  const handleOrderCreated = async (result: CreatedOrderResult) => {
    setActiveTab('orders');
    setPaymentFilter(result.order.paymentStatus === 'paid' ? 'paid' : 'unpaid');
    setHighlightOrderId(result.order.id);
    await refreshOrders({ silent: true });

    triggerNotification(
      result.duplicate
        ? `Order #RD-${result.order.id} already existed — it was not created twice.`
        : `Order #RD-${result.order.id} created.${result.smsSent ? ' Customer notified by SMS.' : ' SMS not delivered.'}`,
      result.smsSent || result.duplicate ? 'success' : 'error'
    );
  };

  /** Sends the confirmation again for an order whose text never arrived. */
  const handleResendSms = async (order: Order) => {
    setBusyOrderId(order.id);
    try {
      const data = await postOrderAction({ action: 'resendSms', orderId: order.id });
      patchOrder(data.order, order.id);
      triggerNotification(data.message, data.smsSent ? 'success' : 'error');
    } catch (err: any) {
      triggerNotification(err.message || 'Could not send that text.', 'error');
    } finally {
      setBusyOrderId(null);
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

  // The green flash on a freshly created order is a "here it is" cue, not a
  // permanent state — leave it up and the table slowly fills with them.
  useEffect(() => {
    if (highlightOrderId === null) return;
    const timer = setTimeout(() => setHighlightOrderId(null), 6000);
    return () => clearTimeout(timer);
  }, [highlightOrderId]);

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
      visibility: productForm.visibility,
      wholesale: productForm.wholesaleEnabled
        ? {
            minQuantity: Number(productForm.wholesaleMinQuantity),
            unitPrice: Number(productForm.wholesalePrice)
          }
        : null,
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
      visibility: p.visibility === 'hidden' ? 'hidden' : 'visible',
      wholesaleEnabled: Boolean(p.wholesale),
      wholesaleMinQuantity: p.wholesale ? String(p.wholesale.minQuantity) : '',
      wholesalePrice: p.wholesale ? String(p.wholesale.unitPrice) : '',
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

      {/* ── Quick-glance Dashboard ─────────────────────────────────── */}
      <section
        style={{
          background: 'rgba(10,10,10,0.5)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '10px',
          padding: 'var(--space-5) var(--space-6)',
          marginBottom: 'var(--space-6)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* red accent line top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #d72638, transparent 60%)' }} />

        <p style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555', margin: '0 0 var(--space-4) 0' }}>
          Dashboard Overview
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          {/* Revenue confirmed */}
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '7px', padding: '12px 14px' }}>
            <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', marginBottom: '6px' }}>Revenue</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'monospace', color: '#10b981', lineHeight: 1 }}>
              GH₵{orders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + o.price, 0).toFixed(2)}
            </div>
            <div style={{ fontSize: '0.62rem', color: '#444', marginTop: '4px' }}>from {orders.filter(o => o.paymentStatus === 'paid').length} paid order{orders.filter(o => o.paymentStatus === 'paid').length !== 1 ? 's' : ''}</div>
          </div>

          {/* Pending value */}
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '7px', padding: '12px 14px' }}>
            <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', marginBottom: '6px' }}>Outstanding</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'monospace', color: '#f59e0b', lineHeight: 1 }}>
              GH₵{orders.filter(o => o.paymentStatus === 'unpaid').reduce((s, o) => s + o.price, 0).toFixed(2)}
            </div>
            <div style={{ fontSize: '0.62rem', color: '#444', marginTop: '4px' }}>{orders.filter(o => o.paymentStatus === 'unpaid').length} awaiting payment</div>
          </div>

          {/* Total orders */}
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '7px', padding: '12px 14px' }}>
            <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', marginBottom: '6px' }}>Total Orders</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'monospace', color: '#fff', lineHeight: 1 }}>{orders.length}</div>
            <div style={{ fontSize: '0.62rem', color: '#444', marginTop: '4px' }}>{orders.filter(o => o.source === 'admin').length} in-store · {orders.filter(o => o.source !== 'admin').length} online</div>
          </div>

          {/* Items sold */}
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '7px', padding: '12px 14px' }}>
            <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', marginBottom: '6px' }}>Units Sold</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'monospace', color: '#fff', lineHeight: 1 }}>
              {orders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + o.totalQuantity, 0)}
            </div>
            <div style={{ fontSize: '0.62rem', color: '#444', marginTop: '4px' }}>confirmed paid orders only</div>
          </div>

          {/* Needs attention */}
          {(() => {
            const attention = orders.filter(needsAttention).length;
            return (
              <div style={{ background: '#0a0a0a', border: `1px solid ${attention > 0 ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '7px', padding: '12px 14px' }}>
                <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', marginBottom: '6px' }}>Needs Checking</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'monospace', color: attention > 0 ? '#ef4444' : '#666', lineHeight: 1 }}>{attention}</div>
                <div style={{ fontSize: '0.62rem', color: '#444', marginTop: '4px' }}>unpaid card orders &gt;1h</div>
              </div>
            );
          })()}

          {/* Products */}
          {(() => {
            const inStock = products.filter(p => !getProductStockSummary(p).isSoldOut).length;
            const soldOut = products.filter(p => getProductStockSummary(p).isSoldOut).length;
            return (
              <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '7px', padding: '12px 14px' }}>
                <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', marginBottom: '6px' }}>Products</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'monospace', color: '#fff', lineHeight: 1 }}>{products.length}</div>
                <div style={{ fontSize: '0.62rem', color: '#444', marginTop: '4px' }}>{inStock} in stock · <span style={{ color: soldOut > 0 ? '#ef4444' : '#444' }}>{soldOut} sold out</span></div>
              </div>
            );
          })()}
        </div>
      </section>

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
                  visibility: 'visible',
                  wholesaleEnabled: false,
                  wholesaleMinQuantity: '',
                  wholesalePrice: '',
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
                    {/* Two independent facts: whether the site shows it, and
                        whether there is anything left to sell. */}
                    {p.visibility === 'hidden' && (
                      <span className={styles.stockPillHidden}>⊘ Hidden from site</span>
                    )}
                    <span className={stock.isSoldOut ? styles.stockPillDanger : styles.stockPill}>
                      {stock.isSoldOut ? 'Out of stock' : 'In stock'}
                    </span>
                    <span className={styles.stockPill}>{p.variants.length} size variants</span>
                    {p.wholesale && (
                      <span className={styles.stockPillBulk}>
                        {p.wholesale.minQuantity}+ @ {formatCurrency(p.wholesale.unitPrice)}
                      </span>
                    )}
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
                    <button className={styles.editButton} onClick={() => setDetailProduct(p)}>
                      Details
                    </button>
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
            <h2 className={styles.sectionTitle}>Customer Orders</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className={styles.saveButton}
                onClick={() => setShowCreateOrderModal(true)}
                style={{ background: '#10b981', color: '#04140e' }}
                title="Record an order taken in person — no payment gateway, SMS sent to the customer."
              >
                + New Order
              </button>
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
                ['paid', `Paid (${orders.filter((o) => o.paymentStatus === 'paid').length})`],
                ['unpaid', `Unpaid (${orders.filter((o) => o.paymentStatus === 'unpaid').length})`],
                ['attention', `Needs checking (${orders.filter(needsAttention).length})`],
                ['failed', `Failed (${orders.filter((o) => o.paymentStatus === 'failed' || o.paymentStatus === 'abandoned').length})`],
                ['instore', `In-store (${orders.filter((o) => o.source === 'admin').length})`],
                ['all', `All (${orders.length})`]
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
                No orders yet. Checkouts from the website land here live — and you can record an
                in-person sale yourself with <strong style={{ color: '#10b981' }}>+ New Order</strong>.
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
                        background:
                          highlightOrderId === o.id
                            ? 'rgba(16, 185, 129, 0.1)'
                            : o.paymentStatus === 'paid'
                            ? 'transparent'
                            : 'rgba(245, 158, 11, 0.03)',
                        opacity: busyOrderId === o.id ? 0.55 : 1,
                        transition: 'opacity 0.15s, background 0.3s'
                      }}
                    >
                      <td style={{ padding: 'var(--space-3)', color: '#555' }}>
                        <div>#RD-{o.id}</div>
                        {o.source === 'admin' && (
                          <div
                            style={{
                              display: 'inline-block',
                              marginTop: '4px',
                              background: 'rgba(16, 185, 129, 0.14)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              borderRadius: '3px',
                              padding: '1px 5px',
                              fontSize: '0.58rem',
                              fontWeight: 'bold',
                              letterSpacing: '0.08em'
                            }}
                            title="Recorded by hand in the admin panel"
                          >
                            IN-STORE
                          </div>
                        )}
                      </td>
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
                          sub GH₵{o.subtotal.toFixed(2)}
                          {o.extras.length > 0 && (
                            <span style={{ color: '#60a5fa' }}>
                              {' '}
                              + svc GH₵{sumOrderExtras(o.extras).toFixed(2)}
                            </span>
                          )}
                          {o.discount > 0 ? (
                            <span style={{ color: '#10b981' }}> − disc GH₵{o.discount.toFixed(2)}</span>
                          ) : o.extras.length === 0 ? (
                            <> + fee GH₵{o.serviceCharge.toFixed(2)}</>
                          ) : null}
                        </div>
                        {/* Named, not just totalled: "what is this GH₵50 for?" is
                            the question a merchant gets asked days later. */}
                        {o.extras.length > 0 && (
                          <div style={{ color: '#60a5fa', fontSize: '0.66rem', fontWeight: 'normal', marginTop: '3px' }}>
                            {o.extras.map((extra) => `${extra.label} GH₵${extra.amount.toFixed(2)}`).join(', ')}
                          </div>
                        )}
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
                                <div>{paymentMethodLabel(o)}</div>

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

                                {/* An undelivered confirmation is invisible unless
                                    it is surfaced here — the customer simply never
                                    hears from us.

                                    Offered only where a confirmation is truthful:
                                    money received, or an order the merchant took
                                    themselves. Texting "order confirmed" to someone
                                    who abandoned checkout would be a lie. */}
                                {!o.smsSent && (o.paymentStatus === 'paid' || o.source === 'admin') && (
                                  <button
                                    onClick={() => handleResendSms(o)}
                                    disabled={busy}
                                    title="Send this order's confirmation text to the customer again."
                                    style={{
                                      background: 'rgba(245, 158, 11, 0.15)',
                                      color: '#f59e0b',
                                      border: '1px solid rgba(245, 158, 11, 0.35)',
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
                                    ✉ Send SMS
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

      {/* In-person order creation */}
      {showCreateOrderModal && (
        <CreateOrderModal
          onClose={() => setShowCreateOrderModal(false)}
          onCreated={handleOrderCreated}
          onPrint={handlePrintOrder}
          products={products}
        />
      )}

      {/* Product Detail Modal ─ clean info sheet, easy to screenshot or print */}
      {detailProduct && (() => {
        const p = detailProduct;
        const stock = getProductStockSummary(p);
        // Group variants by colour
        const byColor = p.variants.reduce<Record<string, typeof p.variants>>((acc, v) => {
          if (!acc[v.color]) acc[v.color] = [];
          acc[v.color].push(v);
          return acc;
        }, {});

        const handlePrintDetail = () => {
          const origin = window.location.origin;
          const logoSrc = `${origin}/assets/icons/redoxlogo.jpg`;
          const colorRows = Object.entries(byColor).map(([color, variants]) => `
            <tr style="border-bottom:1px solid #f0f0f0">
              <td style="padding:8px 12px;font-weight:700;color:#111">${color}</td>
              <td style="padding:8px 12px">
                ${variants.map(v => `<span style="display:inline-block;margin:2px 3px;padding:3px 8px;border-radius:3px;font-size:11px;font-weight:700;background:${v.stockStatus==='in_stock'?'#e8f8f0':'#fdf0f0'};color:${v.stockStatus==='in_stock'?'#0b7a45':'#c0392b'}">${v.size} ${v.inventory != null ? `(${v.inventory})` : ''}</span>`).join('')}
              </td>
            </tr>`).join('');

          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${p.name} — Product Sheet</title>
          <style>*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:20px;background:#f5f5f5;color:#111}
          .sheet{max-width:700px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12)}
          .header{background:#111;padding:20px 24px;display:flex;align-items:center;gap:16px}
          .header img{height:36px;width:auto;object-fit:contain}
          .header h1{color:#fff;font-size:18px;font-weight:800;letter-spacing:0.04em;margin:0;text-transform:uppercase}
          .body{padding:24px}
          .row{display:flex;gap:24px}
          .img-wrap{width:200px;flex-shrink:0;border-radius:6px;overflow:hidden;border:1px solid #eee}
          .img-wrap img{width:100%;display:block;object-fit:cover}
          .info{flex:1}
          h2{font-size:22px;font-weight:800;margin:0 0 4px}
          .price{font-size:20px;font-weight:800;color:#111;margin:0 0 12px}
          .badge{display:inline-block;padding:3px 10px;border-radius:3px;font-size:11px;font-weight:700;background:#111;color:#fff;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.08em}
          .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
          .meta-item .l{font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#999;margin-bottom:2px}
          .meta-item .v{font-size:13px;font-weight:600;color:#111}
          .section-title{font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:#999;margin:16px 0 6px;font-weight:700}
          table{width:100%;border-collapse:collapse;font-size:13px}
          th{background:#f8f8f8;padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#888;font-weight:700}
          .desc{font-size:13px;line-height:1.6;color:#444;margin-top:12px}
          ul{margin:0;padding-left:18px;font-size:13px;color:#444;line-height:1.8}
          .footer{margin-top:20px;padding:12px 24px;background:#f8f8f8;font-size:11px;color:#999;text-align:center;border-top:1px solid #eee}
          @media print{body{background:#fff;padding:0}.sheet{box-shadow:none}}</style></head>
          <body><div class="sheet">
            <div class="header"><img src="${logoSrc}" alt="RedoxDesignx"/><h1>${p.name}</h1></div>
            <div class="body">
              <div class="row">
                <div class="img-wrap"><img src="${p.image}" alt="${p.name}"/></div>
                <div class="info">
                  ${p.badge ? `<div class="badge">${p.badge}</div>` : ''}
                  <h2>${p.name}</h2>
                  <div class="price">GH₵${Number(p.price).toFixed(2)}${p.compareAtPrice ? ` <span style="text-decoration:line-through;color:#bbb;font-size:15px">GH₵${Number(p.compareAtPrice).toFixed(2)}</span>` : ''}</div>
                  <div class="meta-grid">
                    <div class="meta-item"><div class="l">Category</div><div class="v">${p.category || '—'}</div></div>
                    <div class="meta-item"><div class="l">Collection</div><div class="v">${p.collectionName || '—'}</div></div>
                    <div class="meta-item"><div class="l">Material</div><div class="v">${p.material || '—'}</div></div>
                    <div class="meta-item"><div class="l">Fit</div><div class="v">${p.fit || '—'}</div></div>
                    <div class="meta-item"><div class="l">Rating</div><div class="v">${p.rating ? `${p.rating} / 5` : '—'}</div></div>
                    <div class="meta-item"><div class="l">Stock status</div><div class="v" style="color:${stock.isSoldOut?'#c0392b':'#0b7a45'}">${stock.isSoldOut ? 'Sold out' : `In stock${!stock.hasUnlimitedStock && stock.totalKnownStock > 0 ? ` (${stock.totalKnownStock} pcs)` : ''}`}</div></div>
                    <div class="meta-item"><div class="l">Visibility</div><div class="v">${p.visibility === 'hidden' ? '⊘ Hidden' : '✓ Visible'}</div></div>
                    <div class="meta-item"><div class="l">SKU base / ID</div><div class="v">${p.id}</div></div>
                  </div>
                  ${p.wholesale ? `<div style="padding:8px 12px;background:#fffbe8;border:1px solid #f6e05e;border-radius:5px;font-size:12px;color:#7d6608"><strong>Wholesale:</strong> ${p.wholesale.minQuantity}+ pcs @ GH₵${Number(p.wholesale.unitPrice).toFixed(2)} each</div>` : ''}
                </div>
              </div>
              ${p.description ? `<div class="section-title">Description</div><div class="desc">${p.description}</div>` : ''}
              ${p.details && p.details.length > 0 ? `<div class="section-title">Details</div><ul>${p.details.map(d => `<li>${d}</li>`).join('')}</ul>` : ''}
              ${p.care && p.care.length > 0 ? `<div class="section-title">Care Instructions</div><ul>${p.care.map(c => `<li>${c}</li>`).join('')}</ul>` : ''}
              <div class="section-title">Stock by Colour & Size</div>
              <table><thead><tr><th>Colour</th><th>Sizes & Stock</th></tr></thead><tbody>${colorRows}</tbody></table>
            </div>
            <div class="footer">Generated ${new Date().toLocaleString()} · redoxdesignx.com</div>
          </div></body></html>`;

          const w = window.open('', '_blank', 'width=860,height=1000');
          if (!w) { triggerNotification('Allow pop-ups to open the print view.', 'error'); return; }
          w.document.open(); w.document.write(html); w.document.close();
          w.onload = () => { w.focus(); w.print(); };
        };

        return (
          <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setDetailProduct(null); }}>
            <div className={styles.modalContent} style={{ maxWidth: '720px' }}>
              {/* Header */}
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle} style={{ gap: '10px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.visibility === 'hidden' ? '#a78bfa' : '#10b981', display: 'inline-block', flexShrink: 0 }} />
                  {p.name}
                </h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={handlePrintDetail}
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.35)', padding: '7px 14px', borderRadius: '4px', fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
                  >
                    ⎙ Print / Screenshot
                  </button>
                  <button className={styles.closeButton} onClick={() => setDetailProduct(null)}>&times;</button>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: 'var(--space-5) var(--space-6)', display: 'grid', gap: 'var(--space-5)' }}>

                {/* Top row: image + key facts */}
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>
                  <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', aspectRatio: '4/5', position: 'relative', background: '#0a0a0a' }}>
                    <Image src={p.image} alt={p.name} fill style={{ objectFit: 'cover' }} sizes="160px" />
                  </div>

                  <div>
                    {p.badge && (
                      <span style={{ display: 'inline-block', marginBottom: '8px', background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '3px 10px', fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {p.badge}
                      </span>
                    )}
                    <h2 style={{ margin: '0 0 2px', fontSize: 'var(--text-xl)', fontWeight: 800, color: '#fff' }}>{p.name}</h2>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '14px' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace', color: '#fff' }}>GH₵{Number(p.price).toFixed(2)}</span>
                      {p.compareAtPrice && <span style={{ fontSize: '0.9rem', color: '#555', textDecoration: 'line-through', fontFamily: 'monospace' }}>GH₵{Number(p.compareAtPrice).toFixed(2)}</span>}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '0.78rem' }}>
                      {[
                        ['Category', p.category || '—'],
                        ['Collection', p.collectionName || '—'],
                        ['Material', p.material || '—'],
                        ['Fit', p.fit || '—'],
                        ['Rating', p.rating ? `${p.rating} / 5 (${p.reviewCount} reviews)` : '—'],
                        ['Visibility', p.visibility === 'hidden' ? '⊘ Hidden from site' : '✓ Live on site'],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#555', marginBottom: '2px' }}>{label}</div>
                          <div style={{ color: label === 'Visibility' ? (p.visibility === 'hidden' ? '#a78bfa' : '#10b981') : '#ddd', fontWeight: 600 }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* stock status */}
                    <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700, background: stock.isSoldOut ? 'rgba(239,68,68,0.14)' : 'rgba(16,185,129,0.14)', color: stock.isSoldOut ? '#ef4444' : '#10b981', border: `1px solid ${stock.isSoldOut ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                        {stock.isSoldOut ? 'SOLD OUT' : `IN STOCK${!stock.hasUnlimitedStock && stock.totalKnownStock > 0 ? ` · ${stock.totalKnownStock} pcs` : ''}`}
                      </span>
                      <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {p.variants.length} variants
                      </span>
                      {p.wholesale && (
                        <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#f6c667', border: '1px solid rgba(245,158,11,0.3)' }}>
                          Bulk: {p.wholesale.minQuantity}+ @ GH₵{Number(p.wholesale.unitPrice).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {p.description && (
                  <div>
                    <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#555', marginBottom: '6px' }}>Description</div>
                    <p style={{ margin: 0, color: '#bbb', fontSize: '0.85rem', lineHeight: 1.65 }}>{p.description}</p>
                  </div>
                )}

                {/* Details + Care side by side */}
                {(p.details?.length > 0 || p.care?.length > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    {p.details?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#555', marginBottom: '6px' }}>Details</div>
                        <ul style={{ margin: 0, paddingLeft: '16px', color: '#bbb', fontSize: '0.82rem', lineHeight: 1.8 }}>
                          {p.details.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    )}
                    {p.care?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#555', marginBottom: '6px' }}>Care</div>
                        <ul style={{ margin: 0, paddingLeft: '16px', color: '#bbb', fontSize: '0.82rem', lineHeight: 1.8 }}>
                          {p.care.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Stock by colour & size */}
                <div>
                  <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#555', marginBottom: '8px' }}>Stock by Colour & Size</div>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {Object.entries(byColor).map(([color, variants]) => (
                      <div key={color} style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '10px 14px', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, color: '#ddd', fontSize: '0.82rem' }}>{color}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {variants.map((v) => (
                            <span
                              key={v.id}
                              style={{
                                padding: '3px 9px',
                                borderRadius: '3px',
                                fontSize: '0.72rem',
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                background: v.stockStatus === 'in_stock' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                color: v.stockStatus === 'in_stock' ? '#10b981' : '#ef4444',
                                border: `1px solid ${v.stockStatus === 'in_stock' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                              }}
                              title={v.sku}
                            >
                              {v.size}{v.inventory != null ? ` (${v.inventory})` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Colour images preview */}
                {p.colorImages && Object.keys(p.colorImages).length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#555', marginBottom: '8px' }}>Colour Images</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {Object.entries(p.colorImages).flatMap(([color, urls]) =>
                        (urls as string[]).map((url, i) => (
                          <div key={`${color}-${i}`} style={{ position: 'relative', width: '72px', height: '90px', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                            <Image src={url} alt={`${color} ${i + 1}`} fill style={{ objectFit: 'cover' }} sizes="72px" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Product ID / slug row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: 'var(--space-3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {[['ID', p.id], ['Slug', p.slug]].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#555', marginBottom: '2px' }}>{label}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#666' }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Actions footer */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: 'var(--space-2)' }}>
                  <a
                    href={`/products/${p.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.editButton}
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                  >
                    View live ↗
                  </a>
                  <button
                    className={styles.editButton}
                    onClick={() => { setDetailProduct(null); openEditProduct(p); }}
                  >
                    Edit / Update
                  </button>
                  <button className={styles.saveButton} onClick={handlePrintDetail}>
                    ⎙ Print / Screenshot
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
                {/* Visibility — whether the product is on the public site at all */}
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.fieldLabel}>Visibility</label>
                  <div className={styles.segmented}>
                    <button
                      className={`${styles.segment} ${
                        productForm.visibility === 'visible' ? styles.segmentActivePaid : ''
                      }`}
                      onClick={() => setProductForm((p) => ({ ...p, visibility: 'visible' }))}
                      type="button"
                    >
                      👁 Visible
                    </button>
                    <button
                      className={`${styles.segment} ${
                        productForm.visibility === 'hidden' ? styles.segmentActiveHidden : ''
                      }`}
                      onClick={() => setProductForm((p) => ({ ...p, visibility: 'hidden' }))}
                      type="button"
                    >
                      ⊘ Hidden
                    </button>
                  </div>
                  <p
                    className={`${styles.hint} ${
                      productForm.visibility === 'hidden' ? styles.hintWarn : styles.hintOk
                    }`}
                  >
                    {productForm.visibility === 'hidden'
                      ? 'Completely off the website — gone from the shop, search, the homepage and Google, and its page returns “not found”. It stays here in full, so showing it again brings back the photos, sizes and stock exactly as they are.'
                      : 'Live on the website. Sizes marked “Out of stock” below still show as sold out — hide the product only when you want it gone from the site entirely.'}
                  </p>
                </div>

                {/* Wholesale — buy N or more, pay less per piece */}
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.fieldLabel}>Wholesale / Bulk Price</label>
                  <div className={styles.segmented}>
                    <button
                      className={`${styles.segment} ${
                        !productForm.wholesaleEnabled ? styles.segmentActive : ''
                      }`}
                      onClick={() => setProductForm((p) => ({ ...p, wholesaleEnabled: false }))}
                      type="button"
                    >
                      Off
                    </button>
                    <button
                      className={`${styles.segment} ${
                        productForm.wholesaleEnabled ? styles.segmentActivePaid : ''
                      }`}
                      onClick={() => setProductForm((p) => ({ ...p, wholesaleEnabled: true }))}
                      type="button"
                    >
                      ✓ On
                    </button>
                  </div>

                  {productForm.wholesaleEnabled && (
                    <div style={{ marginTop: 'var(--space-3)' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className={styles.fieldLabel} style={{ margin: 0 }}>From</span>
                        <input
                          className={styles.input}
                          min="2"
                          onChange={(e) =>
                            setProductForm((p) => ({ ...p, wholesaleMinQuantity: e.target.value }))
                          }
                          placeholder="5"
                          step="1"
                          style={{ width: '90px' }}
                          type="number"
                          value={productForm.wholesaleMinQuantity}
                        />
                        <span className={styles.fieldLabel} style={{ margin: 0 }}>pieces · each costs GH₵</span>
                        <input
                          className={styles.input}
                          min="0"
                          onChange={(e) =>
                            setProductForm((p) => ({ ...p, wholesalePrice: e.target.value }))
                          }
                          placeholder="200"
                          step="0.01"
                          style={{ width: '120px' }}
                          type="number"
                          value={productForm.wholesalePrice}
                        />
                      </div>

                      {/* The preview is the whole safety net: the merchant reads
                          the deal back in the customer's words before saving. */}
                      {(() => {
                        const base = Number(productForm.price);
                        const min = Number(productForm.wholesaleMinQuantity);
                        const unit = Number(productForm.wholesalePrice);

                        if (!productForm.price) {
                          return <p className={`${styles.hint} ${styles.hintWarn}`}>Set the normal price first.</p>;
                        }
                        if (!productForm.wholesaleMinQuantity || !productForm.wholesalePrice) {
                          return <p className={styles.hint}>Fill both boxes to see the deal.</p>;
                        }
                        if (!Number.isFinite(min) || min < 2) {
                          return (
                            <p className={`${styles.hint} ${styles.hintWarn}`}>
                              ⚠ The trigger must be 2 pieces or more — 1 would just be a lower price.
                            </p>
                          );
                        }
                        if (!Number.isFinite(unit) || unit <= 0) {
                          return <p className={`${styles.hint} ${styles.hintWarn}`}>⚠ Enter a wholesale price above zero.</p>;
                        }
                        if (unit >= base) {
                          return (
                            <p className={`${styles.hint} ${styles.hintWarn}`}>
                              ⚠ GH₵{unit.toFixed(2)} is not below the normal GH₵{base.toFixed(2)} — bulk buyers
                              would pay the same or more. Lower it, or turn wholesale off.
                            </p>
                          );
                        }

                        const saving = base - unit;
                        const percent = Math.round((saving / base) * 100);

                        return (
                          <p className={`${styles.hint} ${styles.hintOk}`}>
                            ✓ Customers see: <strong>“Buy {min}+ and pay GH₵{unit.toFixed(2)} each”</strong>
                            <br />
                            Saves them GH₵{saving.toFixed(2)} per piece ({percent}% off) · {min} pieces ={' '}
                            GH₵{(unit * min).toFixed(2)} instead of GH₵{(base * min).toFixed(2)}
                            <br />
                            Any mix of sizes and colours of this product counts toward the {min}.
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>

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
