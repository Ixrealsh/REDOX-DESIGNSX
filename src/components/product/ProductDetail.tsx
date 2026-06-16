'use client';

import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import type { CSSProperties, MouseEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { HeartIcon, RulerIcon, ShareIcon, StarIcon } from '@/components/ui/Icons';
import { calcOrderTotal, calcServiceCharge, formatCurrency } from '@/lib/format';
import { useWishlistStore } from '@/store/wishlist.store';
import { useCartStore } from '@/store/cart.store';
import type { Product } from '@/types/product';
import { loadPaystackScript } from '@/lib/paystack';
import { getVariantStockLabel, getVariantStockLimit, isVariantInStock } from '@/lib/inventory';
import styles from './ProductDetail.module.css';

interface ProductDetailProps {
  product: Product;
}

export function ProductDetail({ product }: ProductDetailProps) {
  const [selectedColor, setSelectedColor] = useState(product.colors[0] || '');
  const [quantities, setQuantities] = useState<Record<string, Record<string, number>>>({});
  const [activeImage, setActiveImage] = useState(product.image);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [stickyOpen, setStickyOpen] = useState(false);

  // Restore previous color and quantities selections on mount to survive page refreshes
  useEffect(() => {
    try {
      const savedColor = localStorage.getItem(`redox_sel_color_${product.id}`);
      if (savedColor && product.colors.includes(savedColor)) {
        setSelectedColor(savedColor);
      }
      const savedQuantities = localStorage.getItem(`redox_sel_qty_${product.id}`);
      if (savedQuantities) {
        setQuantities(JSON.parse(savedQuantities));
      }
    } catch (e) {
      console.error('Failed to load persisted product choices', e);
    }
  }, [product.id, product.colors]);

  // Persist selected color to localStorage
  useEffect(() => {
    if (selectedColor) {
      localStorage.setItem(`redox_sel_color_${product.id}`, selectedColor);
    }
  }, [selectedColor, product.id]);

  // Persist selected quantities map to localStorage
  useEffect(() => {
    if (Object.keys(quantities).length > 0) {
      localStorage.setItem(`redox_sel_qty_${product.id}`, JSON.stringify(quantities));
    }
  }, [quantities, product.id]);

  // Derived selections
  const selectedSize = useMemo(() => {
    const selections: string[] = [];
    Object.entries(quantities).forEach(([color, sizes]) => {
      Object.entries(sizes).forEach(([size, qty]) => {
        if (qty > 0) {
          selections.push(`${color} / ${size} (x${qty})`);
        }
      });
    });
    return selections.join(', ');
  }, [quantities]);

  const selectedColorString = useMemo(() => {
    const activeColors: string[] = [];
    Object.entries(quantities).forEach(([color, sizes]) => {
      const hasQty = Object.values(sizes).some(qty => qty > 0);
      if (hasQty) {
        activeColors.push(color);
      }
    });
    return activeColors.join(', ') || selectedColor;
  }, [quantities, selectedColor]);

  const totalQuantity = useMemo(() => {
    let sum = 0;
    Object.values(quantities).forEach((sizes) => {
      Object.values(sizes).forEach((qty) => {
        sum += qty;
      });
    });
    return sum;
  }, [quantities]);

  const totalPrice = useMemo(() => {
    return totalQuantity * product.price;
  }, [totalQuantity, product.price]);

  const selectedItems = useMemo(() => {
    return Object.entries(quantities).flatMap(([color, sizes]) =>
      Object.entries(sizes)
        .filter(([, qty]) => qty > 0)
        .map(([size, qty]) => {
          const variant = product.variants.find((candidate) => candidate.color === color && candidate.size === size);
          return variant
            ? {
                productId: product.id,
                productSlug: product.slug,
                variantId: variant.id,
                color,
                size,
                quantity: qty
              }
            : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    );
  }, [product.id, product.slug, product.variants, quantities]);

  const activeColorVariants = useMemo(
    () => product.variants.filter((variant) => variant.color === selectedColor),
    [product.variants, selectedColor]
  );
  
  // Checkout flow states
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    city: 'Greater Accra',
    paymentMethod: 'PAYSTACK',
    momoNetwork: 'MTN',
    momoNumber: ''
  });

  const imageRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<HTMLDivElement>(null);
  const toggleWishlist = useWishlistStore((state) => state.toggleItem);
  const isWishlisted = useWishlistStore((state) => state.isWishlisted(product.id));

  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);

  // Dynamically resolve color-specific picture list
  const colorSpecificImages = useMemo(() => {
    if (product.colorImages && product.colorImages[selectedColor] && product.colorImages[selectedColor].length > 0) {
      return product.colorImages[selectedColor];
    }
    // Fallback if no color specific images are added yet by admin
    return [product.image, product.secondaryImage, 'https://res.cloudinary.com/dti75gff0/image/upload/v1779032145/redox_designsx/redox_hero.png'].filter(Boolean) as string[];
  }, [product.image, product.secondaryImage, product.colorImages, selectedColor]);

  // Sync main image on color change
  useEffect(() => {
    if (colorSpecificImages.length > 0) {
      setActiveImage(colorSpecificImages[0]);
    }
  }, [colorSpecificImages, selectedColor]);

  const selectedVariant = useMemo(
    () =>
      product.variants.find(
        (variant) => variant.size === selectedSize && variant.color === selectedColor && isVariantInStock(variant)
      ) ||
      product.variants.find((variant) => variant.size === selectedSize && isVariantInStock(variant)),
    [product.variants, selectedColor, selectedSize]
  );

  const lowStockMessage = selectedVariant && typeof selectedVariant.inventory === 'number' && selectedVariant.inventory <= 3
    ? `Only ${selectedVariant.inventory} left in ${selectedVariant.size}`
    : '';

  useEffect(() => {
    const handleScroll = () => setStickyOpen(window.scrollY > 760);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    event.currentTarget.style.setProperty('--zoom-x', `${x}%`);
    event.currentTarget.style.setProperty('--zoom-y', `${y}%`);
  };

  const handleBuyNowClick = () => {
    if (!selectedColor) {
      setError('Please select product type / color first.');
      setShaking(true);
      window.setTimeout(() => setShaking(false), 260);
      return;
    }
    if (totalQuantity === 0) {
      setError('Please select quantity for at least one size.');
      setShaking(true);
      window.setTimeout(() => setShaking(false), 260);
      return;
    }
    setError('');
    setShowCheckout(true);
    setTimeout(() => {
      checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const handleAddToCart = () => {
    if (!selectedColor) {
      setError('Please select product type / color first.');
      setShaking(true);
      window.setTimeout(() => setShaking(false), 260);
      return;
    }
    if (totalQuantity === 0) {
      setError('Please select quantity for at least one size.');
      setShaking(true);
      window.setTimeout(() => setShaking(false), 260);
      return;
    }
    setError('');
    
    // Add all sizes across all colors configured with quantity > 0
    Object.entries(quantities).forEach(([color, sizes]) => {
      Object.entries(sizes).forEach(([size, qty]) => {
        if (qty > 0) {
          const variant = product.variants.find(
            (v) => v.size === size && v.color === color && isVariantInStock(v)
          );
          if (variant) {
            const colorImg = product.colorImages?.[color]?.[0] || product.image;
            addItem(product, variant, qty, colorImg);
          }
        }
      });
    });
    
    setQuantities({});
    localStorage.removeItem(`redox_sel_qty_${product.id}`);
    openCart();
  };

  const completeOrderSubmit = async (paymentRef?: string) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          selectedColor: selectedColorString,
          selectedSize,
          price: totalPrice,
          customerName: formData.fullName,
          customerPhone: formData.phone,
          customerEmail: formData.email,
          shippingAddress: formData.address,
          shippingCity: formData.city,
          paymentMethod: formData.paymentMethod,
          momoNetwork: formData.paymentMethod === 'MOMO' ? formData.momoNetwork : undefined,
          momoNumber: formData.paymentMethod === 'MOMO' ? formData.momoNumber : (formData.paymentMethod === 'PAYSTACK' ? paymentRef : undefined),
          items: selectedItems
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to place order.');
      }

      setCheckoutSuccess(resData.order);
      setQuantities({});
      localStorage.removeItem(`redox_sel_qty_${product.id}`);
      setShowCheckout(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit order. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      setError('Please select at least one size with quantity.');
      return;
    }

    setCheckoutLoading(true);
    setError('');

    const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

    if (formData.paymentMethod === 'PAYSTACK') {
      if (!paystackKey || paystackKey === 'your_paystack_public_key_here') {
        setError('Live checkout is currently disabled. Please configure your public key.');
        setCheckoutLoading(false);
        return;
      }

      try {
        const paystack = await loadPaystackScript();
        if (!paystack) {
          throw new Error('Paystack secure payment library failed to load. Please check your internet connection or disable ad-blockers.');
        }

        const handler = paystack.setup({
          key: paystackKey,
          email: formData.email,
          amount: Math.round(calcOrderTotal(totalPrice) * 100), // pesewas — includes 2% service charge
          currency: 'GHS',
          reference: 'RDX-' + Math.floor(Math.random() * 1000000000 + 1),
          callback: (response: any) => {
            completeOrderSubmit(response.reference).catch((err) => {
              console.error('Failed to complete order post-payment:', err);
            });
          },
          onClose: () => {
            setCheckoutLoading(false);
            setError('Paystack transaction was cancelled by the user.');
          }
        });

        handler.openIframe();
        return;
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Paystack initialization failed. Please use another method.');
        setCheckoutLoading(false);
        return;
      }
    }

    // Default flow for COD / MOMO
    await completeOrderSubmit();
  };

  return (
    <>
      <section className={styles.pdp}>
        <div className={styles.gallery} ref={imageRef}>
          <div className={styles.mainImage}>
            <Image alt={product.imageAlt} fill priority sizes="(min-width: 980px) 58vw, 100vw" src={activeImage} />
          </div>
          {colorSpecificImages.filter((img) => img !== activeImage).length > 0 && (
            <div className={styles.thumbs}>
              {colorSpecificImages.filter((img) => img !== activeImage).map((image) => (
                <button className={styles.thumb} key={image} onClick={() => setActiveImage(image)} type="button">
                  <Image alt="" fill sizes="180px" src={image} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <p className={styles.collection}>{product.collectionName}</p>
          <h1 className={styles.name}>{product.name}</h1>
          <div className={styles.rating}>
            <StarIcon />
            <span>
              {product.rating} / {product.reviewCount} reviews
            </span>
          </div>
          <div className={styles.priceRow}>
            <span className={product.compareAtPrice ? styles.salePrice : ''}>{formatCurrency(product.price)}</span>
            {product.compareAtPrice ? (
              <span className={styles.comparePrice}>{formatCurrency(product.compareAtPrice)}</span>
            ) : null}
          </div>
          {product.description && (
            <p className={styles.description}>{product.description}</p>
          )}

          {/* Color Selector Grid */}
          <div className={styles.optionGroup}>
            <div className={styles.optionHeader}>
              <h2 className={styles.optionTitle}>Color / {selectedColor || 'Select Product Type'}</h2>
            </div>
            <div className={styles.colorGrid}>
              {product.colors.map((color) => {
                const imageUrl = product.colorImages?.[color]?.[0] || product.image;
                const isSelected = selectedColor === color;
                const colorQty = Object.values(quantities[color] || {}).reduce((acc, curr) => acc + curr, 0);
                return (
                  <div
                    className={`${styles.colorCard} ${isSelected ? styles.colorCardActive : ''}`}
                    key={color}
                    onClick={() => setSelectedColor(color)}
                  >
                    <div className={styles.colorCardImageWrapper}>
                      <img 
                        className={styles.colorCardImage} 
                        src={imageUrl} 
                        alt={color} 
                      />
                      {colorQty > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          background: 'var(--color-red)',
                          color: '#fff',
                          fontWeight: 'bold',
                          fontSize: '0.7rem',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 10,
                          boxShadow: '0 0 8px rgba(215, 38, 56, 0.6)',
                          border: '1.5px solid #000',
                          fontFamily: 'monospace'
                        }}>
                          {colorQty}
                        </div>
                      )}
                    </div>
                    <div className={styles.colorCardLabel}>
                      {color}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Size Multi-Quantity Selector Row List */}
          <div className={`${styles.optionGroup} ${shaking ? styles.shaking : ''}`}>
            <div className={styles.optionHeader}>
              <h2 className={styles.optionTitle}>Select Sizes & Quantities</h2>
              <Link className={styles.sizeGuide} href="/size-guide">
                <RulerIcon /> Size guide
              </Link>
            </div>
            
            {!selectedColor ? (
              <p style={{ fontSize: '0.825rem', color: '#888', margin: 'var(--space-2) 0', fontStyle: 'italic' }}>
                Please select a color variant card above to manage sizes.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                {activeColorVariants
                  .map((variant) => {
                    const size = variant.size;
                    const qty = quantities[selectedColor]?.[size] || 0;
                    const stockLimit = getVariantStockLimit(variant);
                    const inStock = isVariantInStock(variant);

                    return (
                      <div 
                        key={size}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--space-3) var(--space-4)',
                          background: 'var(--color-surface-2)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          opacity: inStock ? 1 : 0.6
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>Size {size}</span>
                          <span style={{ fontSize: '0.75rem', color: '#888', marginTop: 2 }}>
                            {formatCurrency(product.price)} - {getVariantStockLabel(variant)}
                          </span>
                        </div>
                        
                        {inStock && product.badge !== 'COMING SOON' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setQuantities(q => ({
                                  ...q,
                                  [selectedColor]: {
                                    ...(q[selectedColor] || {}),
                                    [size]: Math.max(0, (q[selectedColor]?.[size] || 0) - 1)
                                  }
                                }));
                              }}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: '1px solid var(--color-border)',
                                background: 'transparent',
                                color: '#fff',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'border-color 0.2s'
                              }}
                            >
                              -
                            </button>
                            <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setQuantities(q => ({
                                  ...q,
                                  [selectedColor]: {
                                    ...(q[selectedColor] || {}),
                                    [size]: Math.min(stockLimit, (q[selectedColor]?.[size] || 0) + 1)
                                  }
                                }));
                              }}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: '1px solid var(--color-border)',
                                background: 'transparent',
                                color: '#fff',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'border-color 0.2s'
                              }}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                            Sold Out
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
            {error && !showCheckout && <p className={styles.error}>{error}</p>}
          </div>

          {/* Extremely visual Selection Summary Breakdown Card */}
          {totalQuantity > 0 && !checkoutSuccess && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 16, 16, 0.95) 0%, rgba(8, 8, 8, 0.99) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '24px',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: '0.85rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            }}>
              {/* Header Title with Glowing Dot */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  background: 'var(--color-red)', 
                  boxShadow: '0 0 8px var(--color-red)' 
                }}></span>
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  letterSpacing: '0.12em', 
                  color: 'var(--color-steel)', 
                  textTransform: 'uppercase' 
                }}>
                  SELECTION MANIFEST
                </span>
              </div>

              <div style={{ display: 'grid', gap: '12px' }}>
                {Object.entries(quantities).flatMap(([color, sizesObj]) => {
                  const selectedSizes = Object.entries(sizesObj).filter(([_, qty]) => qty > 0);
                  return selectedSizes.map(([sz, qty]) => {
                    const colorHexMap: Record<string, string> = {
                      'Obsidian Black': '#090909',
                      'Oxide Bone': '#f5f3ee',
                      'Signal Red': '#d72638',
                      'Graphite': '#2b2c2d'
                    };
                    const swatchColor = colorHexMap[color] || '#555555';

                    return (
                      <div key={`${color}-${sz}`} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ 
                            display: 'inline-block', 
                            width: '10px', 
                            height: '10px', 
                            borderRadius: '50%', 
                            background: swatchColor, 
                            border: '1px solid rgba(255, 255, 255, 0.2)' 
                          }}></span>
                          <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>{color} / Size {sz} <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem', fontWeight: 400, marginLeft: '6px' }}>(x{qty})</span></span>
                        </div>
                        <span style={{ color: '#fff', fontSize: '0.8rem', fontFamily: 'var(--font-mono), monospace' }}>GH₵{product.price * qty}</span>
                      </div>
                    );
                  });
                })}
              </div>

              {/* Total Item Count */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                borderTop: '1px solid rgba(255, 255, 255, 0.08)', 
                paddingTop: '12px', 
                marginTop: '12px', 
                fontSize: '0.8rem', 
                color: 'var(--color-text-secondary)' 
              }}>
                <span>TOTAL QUANTITY</span>
                <span>{totalQuantity} {totalQuantity === 1 ? 'piece' : 'pieces'}</span>
              </div>

              {/* Invoice breakdown */}
              <div style={{ marginTop: '6px', borderTop: '1px dashed rgba(255, 255, 255, 0.08)', paddingTop: '10px', display: 'grid', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  <span>SUBTOTAL</span>
                  <span>{formatCurrency(totalPrice)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  <span>SERVICE CHARGE (2%)</span>
                  <span>{formatCurrency(calcServiceCharge(totalPrice))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>ORDER TOTAL</span>
                  <span style={{ fontSize: '1.18rem', fontWeight: 700, color: 'var(--color-red)', letterSpacing: '0.02em', textShadow: '0 0 10px rgba(215, 38, 56, 0.25)' }}>
                    {formatCurrency(calcOrderTotal(totalPrice))}
                  </span>
                </div>
              </div>

              {/* Sleek Streetwear Barcode */}
              <div style={{ 
                marginTop: '18px', 
                paddingTop: '14px', 
                borderTop: '1px solid rgba(255, 255, 255, 0.05)', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '6px', 
                opacity: 0.35 
              }}>
                <svg width="100%" height="20" style={{ display: 'block' }}>
                  <rect x="0" width="2" height="20" fill="#fff" />
                  <rect x="4" width="4" height="20" fill="#fff" />
                  <rect x="10" width="1" height="20" fill="#fff" />
                  <rect x="13" width="2" height="20" fill="#fff" />
                  <rect x="18" width="6" height="20" fill="#fff" />
                  <rect x="26" width="2" height="20" fill="#fff" />
                  <rect x="30" width="1" height="20" fill="#fff" />
                  <rect x="34" width="4" height="20" fill="#fff" />
                  <rect x="40" width="2" height="20" fill="#fff" />
                  <rect x="44" width="1" height="20" fill="#fff" />
                  <rect x="48" width="6" height="20" fill="#fff" />
                  <rect x="56" width="3" height="20" fill="#fff" />
                  <rect x="62" width="1" height="20" fill="#fff" />
                  <rect x="66" width="4" height="20" fill="#fff" />
                  <rect x="72" width="2" height="20" fill="#fff" />
                  <rect x="76" width="1" height="20" fill="#fff" />
                  <rect x="80" width="8" height="20" fill="#fff" />
                  <rect x="90" width="2" height="20" fill="#fff" />
                  <rect x="94" width="3" height="20" fill="#fff" />
                  <rect x="99" width="1" height="20" fill="#fff" />
                  <rect x="102" width="4" height="20" fill="#fff" />
                  <rect x="108" width="2" height="20" fill="#fff" />
                  <rect x="112" width="1" height="20" fill="#fff" />
                  <rect x="116" width="6" height="20" fill="#fff" />
                  <rect x="124" width="2" height="20" fill="#fff" />
                  <rect x="128" width="4" height="20" fill="#fff" />
                  <rect x="134" width="1" height="20" fill="#fff" />
                  <rect x="137" width="2" height="20" fill="#fff" />
                  <rect x="142" width="6" height="20" fill="#fff" />
                  <rect x="150" width="2" height="20" fill="#fff" />
                  <rect x="154" width="1" height="20" fill="#fff" />
                  <rect x="158" width="4" height="20" fill="#fff" />
                  <rect x="164" width="2" height="20" fill="#fff" />
                  <rect x="168" width="1" height="20" fill="#fff" />
                  <rect x="172" width="6" height="20" fill="#fff" />
                  <rect x="180" width="3" height="20" fill="#fff" />
                  <rect x="186" width="1" height="20" fill="#fff" />
                  <rect x="190" width="4" height="20" fill="#fff" />
                  <rect x="196" width="2" height="20" fill="#fff" />
                  <rect x="200" width="1" height="20" fill="#fff" />
                  <rect x="204" width="8" height="20" fill="#fff" />
                  <rect x="214" width="2" height="20" fill="#fff" />
                  <rect x="218" width="3" height="20" fill="#fff" />
                  <rect x="223" width="1" height="20" fill="#fff" />
                  <rect x="226" width="4" height="20" fill="#fff" />
                  <rect x="232" width="2" height="20" fill="#fff" />
                  <rect x="236" width="1" height="20" fill="#fff" />
                  <rect x="240" width="6" height="20" fill="#fff" />
                  <rect x="248" width="2" height="20" fill="#fff" />
                  <rect x="252" width="4" height="20" fill="#fff" />
                  <rect x="258" width="1" height="20" fill="#fff" />
                  <rect x="261" width="2" height="20" fill="#fff" />
                  <rect x="266" width="6" height="20" fill="#fff" />
                  <rect x="274" width="2" height="20" fill="#fff" />
                  <rect x="278" width="1" height="20" fill="#fff" />
                  <rect x="282" width="4" height="20" fill="#fff" />
                  <rect x="288" width="2" height="20" fill="#fff" />
                  <rect x="292" width="1" height="20" fill="#fff" />
                  <rect x="296" width="6" height="20" fill="#fff" />
                  <rect x="304" width="3" height="20" fill="#fff" />
                  <rect x="310" width="1" height="20" fill="#fff" />
                  <rect x="314" width="4" height="20" fill="#fff" />
                  <rect x="320" width="2" height="20" fill="#fff" />
                  <rect x="324" width="1" height="20" fill="#fff" />
                  <rect x="328" width="8" height="20" fill="#fff" />
                </svg>
                <span style={{ fontSize: '0.55rem', letterSpacing: '0.25em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  REDOX-DESIGNSX-SYS-VER-1.0
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons: Instantly Checkout or Add to Cart */}
          {!checkoutSuccess && (
            <div className={styles.actions}>
              <div className={styles.mainButtons}>
                <Button disabled={product.badge === 'COMING SOON'} fullWidth onClick={handleBuyNowClick}>
                  {product.badge === 'COMING SOON' ? 'Coming soon' : 'Buy & Place Order Now'}
                </Button>
                {product.badge !== 'COMING SOON' && (
                  <button className={styles.addToCartButton} onClick={handleAddToCart} type="button">
                    Add to Cart
                  </button>
                )}
              </div>
              
              <div className={styles.utilityButtons}>
                <button
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  aria-pressed={isWishlisted}
                  className={`${styles.iconAction} ${isWishlisted ? styles.iconActionActive : ''}`}
                  onClick={() => toggleWishlist(product)}
                  type="button"
                >
                  <HeartIcon />
                </button>
                <button
                  aria-label="Share product"
                  className={styles.iconAction}
                  onClick={() => navigator.clipboard?.writeText(window.location.href)}
                  type="button"
                >
                  <ShareIcon />
                </button>
              </div>
            </div>
          )}

          {/* Direct Checkout Form (Unfolds smoothly when active) */}
          {showCheckout && !checkoutSuccess && (
            <div className={styles.directCheckout} ref={checkoutRef}>
              <div className={styles.checkoutHeader}>
                SECURE CHECKOUT — {formatCurrency(calcOrderTotal(totalPrice))}
              </div>
              
              <form onSubmit={handleOrderSubmit} className={styles.checkoutForm}>
                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel}>FULL NAME *</label>
                  <input
                    type="text"
                    required
                    className={styles.formInput}
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={(e) => setFormData(f => ({ ...f, fullName: e.target.value }))}
                  />
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.fieldLabel}>PHONE NUMBER *</label>
                    <input
                      type="tel"
                      required
                      className={styles.formInput}
                      placeholder="e.g. 054XXXXXXX"
                      value={formData.phone}
                      onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.fieldLabel}>EMAIL ADDRESS *</label>
                    <input
                      type="email"
                      required
                      className={styles.formInput}
                      placeholder="name@domain.com"
                      value={formData.email}
                      onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.fieldLabel}>SHIPPING ADDRESS *</label>
                  <input
                    type="text"
                    required
                    className={styles.formInput}
                    placeholder="e.g. Hse No 42, Spintex Rd"
                    value={formData.address}
                    onChange={(e) => setFormData(f => ({ ...f, address: e.target.value }))}
                  />
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.fieldLabel}>CITY / REGION *</label>
                    <select
                      className={styles.formSelect}
                      value={formData.city}
                      onChange={(e) => setFormData(f => ({ ...f, city: e.target.value }))}
                    >
                      <option value="Greater Accra">Greater Accra Region</option>
                      <option value="Ashanti">Ashanti Region</option>
                      <option value="Western">Western Region</option>
                      <option value="Eastern">Eastern Region</option>
                      <option value="Central">Central Region</option>
                      <option value="Volta">Volta Region</option>
                      <option value="Northern">Northern Region</option>
                      <option value="Upper East">Upper East Region</option>
                      <option value="Upper West">Upper West Region</option>
                      <option value="Savannah">Savannah Region</option>
                      <option value="North East">North East Region</option>
                      <option value="Bono">Bono Region</option>
                      <option value="Bono East">Bono East Region</option>
                      <option value="Ahafo">Ahafo Region</option>
                      <option value="Western North">Western North Region</option>
                      <option value="Oti">Oti Region</option>
                    </select>
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <div style={{
                      padding: 'var(--space-3) var(--space-4)',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      color: '#10b981',
                      fontSize: '0.85rem',
                      lineHeight: '1.4'
                    }}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span><strong>SECURED BY PAYSTACK</strong> — Cards (Visa/Mastercard), Mobile Money (MTN, Telecel, AT), and bank channels are accepted instantly.</span>
                    </div>
                  </div>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <button
                  type="submit"
                  disabled={checkoutLoading}
                  className={styles.placeOrderButton}
                >
                  {checkoutLoading ? 'Processing Secure Order...' : `Confirm & Pay ${formatCurrency(calcOrderTotal(totalPrice))}`}
                </button>
              </form>
            </div>
          )}

          {/* Gorgeous Order Success Screen */}
          {checkoutSuccess && (
            <div className={styles.successCard}>
              <div className={styles.successIcon}>
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#10b981" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className={styles.successTitle}>ORDER PLACED SUCCESSFULLY!</h2>
              <p className={styles.successMessage}>
                Thank you for your order, <strong>{checkoutSuccess.customerName}</strong>! Your order reference is{' '}
                <span className={styles.refCode}>#RD-{checkoutSuccess.id}</span>.
              </p>
              <div className={styles.successSummary}>
                <p><strong>Item:</strong> {product.name} ({selectedColor} / {selectedSize})</p>
                <p><strong>Total:</strong> {formatCurrency(checkoutSuccess.price)}</p>
                <p><strong>Shipping to:</strong> {checkoutSuccess.shippingAddress}, {checkoutSuccess.shippingCity}</p>
                <p><strong>Payment:</strong> Paystack Secure Checkout</p>
              </div>
              <p className={styles.successFooter}>
                Our sales team will contact you via <strong>{checkoutSuccess.customerPhone}</strong> shortly to finalize dispatch and shipping details!
              </p>
              <button 
                onClick={() => {
                  setCheckoutSuccess(null);
                  setQuantities({});
                }}
                className={styles.resetButton}
              >
                Order another piece
              </button>
            </div>
          )}

          <div className={styles.details}>
            {product.material && (
              <div className={styles.detailBlock}>
                <h2>Material</h2>
                <p>{product.material}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Dynamic Sticky Bar (Buy Now triggers checkout directly) */}
      {!checkoutSuccess && (
        <div className={`${styles.stickyBar} ${stickyOpen ? styles.stickyOpen : ''}`} aria-live="polite">
          <div>
            <p className={styles.stickyName}>{product.name}</p>
            <p className={styles.stickyMeta}>
              {selectedSize || 'Select size'} / {formatCurrency(product.price)}
            </p>
          </div>
          <Button disabled={product.badge === 'COMING SOON'} onClick={handleBuyNowClick}>
            {product.badge === 'COMING SOON' ? 'Coming soon' : 'Buy Now'}
          </Button>
        </div>
      )}
      <Script src="https://js.paystack.co/v1/inline.js" strategy="lazyOnload" />
    </>
  );
}
