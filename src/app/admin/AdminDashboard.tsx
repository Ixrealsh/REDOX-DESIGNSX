'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import type { Product, Drop, Collection, LookbookIssue, Order } from '@/types/product';
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
  const [isDbConnected, setIsDbConnected] = useState(initialDbStatus);
  
  // Database Initializing State
  const [isInitializing, setIsInitializing] = useState(false);
  const [isRefreshingWaitlist, setIsRefreshingWaitlist] = useState(false);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
  
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
    collectionSlug: 'chemical-uniform',
    collectionName: 'Chemical Uniform',
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
  const refreshOrders = async () => {
    setIsRefreshingOrders(true);
    try {
      const response = await fetch('/api/admin/orders');
      const data = await response.json();
      if (response.ok && Array.isArray(data.orders)) {
        setOrders(data.orders);
        triggerNotification('Customer direct orders synced live from Neon DB!', 'success');
      }
    } catch (err: any) {
      triggerNotification(err.message || 'Failed to sync orders.', 'error');
    } finally {
      setIsRefreshingOrders(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      const response = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status })
      });
      const data = await response.json();
      if (response.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
        triggerNotification(`Order #RD-${orderId} status set to "${status}" successfully!`, 'success');
      } else {
        throw new Error(data.error || 'Failed to update order status.');
      }
    } catch (err: any) {
      triggerNotification(err.message || 'Error updating order status.', 'error');
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (!window.confirm(`Are you absolutely sure you want to permanently delete order #RD-${orderId}?`)) return;
    try {
      const response = await fetch(`/api/admin/orders?orderId=${orderId}`, {
        method: 'DELETE'
      });
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

    for (const variant of colorVariants) {
      const color = variant.colorName.trim();
      if (!color) continue;

      for (const sizeRow of variant.sizes) {
        const size = sizeRow.size.trim();
        if (!size) continue;

        if (sizeRow.stockStatus !== 'out_of_stock') {
          const rawStock = Number(sizeRow.stockQuantity);
          if (sizeRow.stockQuantity.trim() === '' || !Number.isFinite(rawStock) || rawStock < 1) {
            triggerNotification(`Enter stock quantity for ${color} / ${size}.`, 'error');
            return;
          }
        }
      }
    }

    const finalVariants = colorVariants.flatMap((variant) => {
      const color = variant.colorName.trim();
      if (!color) return [];

      return variant.sizes
        .map((sizeRow) => {
          const size = sizeRow.size.trim();
          if (!size) return null;

          const rawStock = Number(sizeRow.stockQuantity);
          const stockStatus: AdminStockStatus =
            sizeRow.stockStatus === 'out_of_stock' ? 'out_of_stock' : 'in_stock';
          const parsedStock =
            stockStatus === 'out_of_stock' ? 0 : Math.max(1, Math.floor(rawStock));

          return {
            id: `${finalId}-${slugify(color)}-${slugify(size)}`,
            size,
            color,
            inventory: parsedStock,
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
                  collectionSlug: 'chemical-uniform',
                  collectionName: 'Chemical Uniform',
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
                    {!stock.isSoldOut && (
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
            <button 
              className={styles.saveButton}
              onClick={refreshOrders}
              disabled={isRefreshingOrders}
            >
              {isRefreshingOrders ? 'Syncing...' : '↻ Sync orders'}
            </button>
          </div>

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
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Product Name</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Options</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Price</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Shipping Destination</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Payment Info</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Order Status</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Date Placed</th>
                    <th style={{ padding: 'var(--space-3)', color: '#aaa', fontWeight: 600 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: 'var(--space-3)', color: '#555' }}>#RD-{o.id}</td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <div style={{ fontWeight: 'bold', color: '#fff' }}>{o.customerName}</div>
                        <div style={{ color: '#aaa', fontSize: '0.75rem' }}>{o.customerPhone}</div>
                        <div style={{ color: '#777', fontSize: '0.7rem' }}>{o.customerEmail}</div>
                      </td>
                      <td style={{ padding: 'var(--space-3)', color: '#10b981', fontWeight: 'bold' }}>{o.productName}</td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '3px', marginRight: '4px' }}>
                          {o.selectedColor}
                        </span>
                        <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 6px', borderRadius: '3px' }}>
                          {o.selectedSize}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-3)', color: '#fff', fontWeight: 'bold' }}>GH₵{o.price}</td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <div style={{ color: '#f5f3ee' }}>{o.shippingAddress}</div>
                        <div style={{ color: '#888', fontSize: '0.75rem' }}>{o.shippingCity}</div>
                      </td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        {o.paymentMethod === 'PAYSTACK' ? (
                          <div>
                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>Paystack Secure</span>
                            {o.momoNumber && <div style={{ color: '#888', fontSize: '0.725rem', marginTop: '4px' }}>Ref: {o.momoNumber}</div>}
                          </div>
                        ) : o.paymentMethod === 'COD' ? (
                          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>Cash on Delivery</span>
                        ) : (
                          <div>
                            <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>MOMO ({o.momoNetwork})</span>
                            <div style={{ color: '#888', fontSize: '0.75rem' }}>{o.momoNumber}</div>
                          </div>
                        )}
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
                          <option value="Pending" style={{ background: '#111', color: '#f59e0b' }}>Pending</option>
                          <option value="Processing" style={{ background: '#111', color: '#3b82f6' }}>Processing</option>
                          <option value="Shipped" style={{ background: '#111', color: '#8b5cf6' }}>Shipped</option>
                          <option value="Delivered" style={{ background: '#111', color: '#10b981' }}>Delivered</option>
                          <option value="Cancelled" style={{ background: '#111', color: '#ef4444' }}>Cancelled</option>
                        </select>
                      </td>
                      <td style={{ padding: 'var(--space-3)', color: '#777' }}>{new Date(o.createdAt).toLocaleString()}</td>
                      <td style={{ padding: 'var(--space-3)' }}>
                        <button
                          onClick={() => handleDeleteOrder(o.id)}
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
                                <span>Only these sizes appear when this color is selected.</span>
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
                                    placeholder="Qty"
                                    required={sizeRow.stockStatus === 'in_stock'}
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
