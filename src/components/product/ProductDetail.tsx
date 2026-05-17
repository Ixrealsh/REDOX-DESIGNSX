'use client';

import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import type { CSSProperties, MouseEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { HeartIcon, RulerIcon, ShareIcon, StarIcon } from '@/components/ui/Icons';
import { formatCurrency } from '@/lib/format';
import { useWishlistStore } from '@/store/wishlist.store';
import { useCartStore } from '@/store/cart.store';
import type { Product } from '@/types/product';
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
  
  // Checkout flow states
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    city: 'Accra',
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
    return [product.image, product.secondaryImage, '/assets/images/campaigns/redox-hero.png'].filter(Boolean) as string[];
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
        (variant) => variant.size === selectedSize && variant.color === selectedColor && variant.inventory > 0
      ) ||
      product.variants.find((variant) => variant.size === selectedSize && variant.inventory > 0),
    [product.variants, selectedColor, selectedSize]
  );

  const lowStockMessage = selectedVariant && selectedVariant.inventory <= 3
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
            (v) => v.size === size && v.color === color && v.inventory > 0
          );
          if (variant) {
            addItem(product, variant, qty);
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
          momoNumber: formData.paymentMethod === 'MOMO' ? formData.momoNumber : (formData.paymentMethod === 'PAYSTACK' ? paymentRef : undefined)
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
    if (!selectedSize) {
      setError('Please select at least one size with quantity.');
      return;
    }

    setCheckoutLoading(true);
    setError('');

    const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

    if (formData.paymentMethod === 'PAYSTACK') {
      if (paystackKey && paystackKey !== 'your_paystack_public_key_here') {
        try {
          const paystack = (window as any).PaystackPop;
          if (!paystack) {
            throw new Error('Paystack secure payment library is loading. Please click pay again in a second.');
          }

          const handler = paystack.setup({
            key: paystackKey,
            email: formData.email,
            amount: totalPrice * 100, // minor units
            currency: 'GHS',
            ref: 'RDX-' + Math.floor(Math.random() * 1000000000 + 1),
            callback: async (response: any) => {
              await completeOrderSubmit(response.reference);
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
      } else {
        // Safe Simulation Mode: Runs automatically to demo and verify checkout if keys are not ready!
        setError('');
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const demoRef = 'RDX-DEMO-' + Math.floor(Math.random() * 1000000000 + 1);
        await completeOrderSubmit(demoRef);
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
          <div
            className={styles.mainImage}
            onMouseMove={handleMouseMove}
            style={{ transformOrigin: 'var(--zoom-x, 50%) var(--zoom-y, 50%)' }}
          >
            <Image alt={product.imageAlt} fill priority sizes="(min-width: 980px) 58vw, 100vw" src={activeImage} />
          </div>
          <div className={styles.thumbs}>
            {colorSpecificImages.map((image) => (
              <button className={styles.thumb} key={image} onClick={() => setActiveImage(image)} type="button">
                <Image alt="" fill sizes="180px" src={image} />
              </button>
            ))}
          </div>
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
          <p className={styles.description}>{product.description}</p>

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
                {product.variants
                  .filter((variant) => variant.color === selectedColor)
                  .map((variant) => {
                    const size = variant.size;
                    const qty = quantities[selectedColor]?.[size] || 0;
                    const inStock = variant.inventory > 0;

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
                            {formatCurrency(product.price)} • {inStock ? `In Stock` : 'Sold Out'}
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
                                    [size]: Math.min(variant.inventory, (q[selectedColor]?.[size] || 0) + 1)
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

          {/* Dynamic Selection Summary Strip */}
          {totalQuantity > 0 && !checkoutSuccess && (
            <div 
              style={{ 
                background: 'rgba(215, 38, 56, 0.08)', 
                border: '1px solid rgba(215, 38, 56, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                marginBottom: 'var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#fff',
                fontSize: '0.875rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-red)' }}></span>
                <strong>{totalQuantity} x Items Selected</strong>
              </div>
              <span style={{ fontWeight: 800, color: 'var(--color-red)' }}>{formatCurrency(totalPrice)}</span>
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
                ⚡ DIRECT SECURE CHECKOUT — {formatCurrency(product.price)}
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
                      <option value="Accra">Accra (Greater Accra)</option>
                      <option value="Kumasi">Kumasi (Ashanti)</option>
                      <option value="Tema">Tema (Greater Accra)</option>
                      <option value="Takoradi">Sekondi-Takoradi (Western)</option>
                      <option value="Tamale">Tamale (Northern)</option>
                      <option value="Cape Coast">Cape Coast (Central)</option>
                      <option value="Koforidua">Koforidua (Eastern)</option>
                      <option value="Sunyani">Sunyani (Bono)</option>
                      <option value="Ho">Ho (Volta)</option>
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
                  {checkoutLoading ? 'Processing Secure Order...' : `Confirm & Place Order — ${formatCurrency(product.price)}`}
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
            <div className={styles.detailBlock}>
              <h2>Story</h2>
              <p>{product.story}</p>
            </div>
            <div className={styles.detailBlock}>
              <h2>Details</h2>
              <ul>
                {product.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
            <div className={styles.detailBlock}>
              <h2>Fit and material</h2>
              <p>{product.fit}</p>
              <p>{product.material}</p>
            </div>
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
