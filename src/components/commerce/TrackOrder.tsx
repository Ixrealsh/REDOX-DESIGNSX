'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/format';

export function TrackOrder() {
  const [refInput, setRefInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refInput.trim()) {
      setError('Please input a valid order reference or Paystack ID.');
      return;
    }

    setLoading(true);
    setError('');
    setOrder(null);

    try {
      const response = await fetch(`/api/orders?ref=${encodeURIComponent(refInput.trim())}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to trace this order reference.');
      }

      setOrder(data.order);
    } catch (err: any) {
      setError(err.message || 'No order records correspond to this reference.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return '#f59e0b';
      case 'Processing':
        return '#3b82f6';
      case 'Shipped':
        return '#8b5cf6';
      case 'Delivered':
        return '#10b981';
      default:
        return '#ef4444';
    }
  };

  const getStepIndex = (status: string) => {
    switch (status) {
      case 'Pending':
        return 0;
      case 'Processing':
        return 1;
      case 'Shipped':
        return 2;
      case 'Delivered':
        return 3;
      default:
        return -1;
    }
  };

  const stepIndex = order ? getStepIndex(order.status) : -1;

  return (
    <div style={{
      background: 'rgba(10, 10, 10, 0.65)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-6) var(--space-5)',
      width: '100%',
      maxWidth: '640px',
      margin: '80px auto 0',
      fontFamily: 'monospace'
    }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
        <h3 style={{
          color: '#fff',
          fontSize: '0.9rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          margin: '0 0 6px 0',
          fontFamily: 'var(--font-mono)'
        }}>
          🎯 TRACK YOUR PIECE
        </h3>
        <p style={{ color: '#888', fontSize: '0.75rem', margin: 0 }}>
          Enter your order receipt reference (e.g. #RD-1209) or Paystack ID to search live status.
        </p>
      </div>

      <form onSubmit={handleTrackSubmit} style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-3)' }}>
        <input
          type="text"
          value={refInput}
          onChange={(e) => setRefInput(e.target.value)}
          placeholder="e.g. #RD-1025 or RDX-DEMO-991"
          style={{
            flex: 1,
            height: '44px',
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 'var(--radius-md)',
            color: '#fff',
            padding: '0 16px',
            fontSize: '0.85rem',
            fontFamily: 'monospace',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => (e.target.style.borderColor = '#10b981')}
          onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            background: '#fff',
            color: '#000',
            fontWeight: 'bold',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '0 20px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            border: 'none',
            transition: 'opacity 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
        >
          {loading ? 'Searching...' : 'Trace'}
        </button>
      </form>

      {error && (
        <div style={{
          color: '#ef4444',
          fontSize: '0.75rem',
          textAlign: 'center',
          marginTop: '8px',
          padding: '8px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          borderRadius: '4px'
        }}>
          ✕ {error}
        </div>
      )}

      {order && (
        <div style={{
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255,255,255,0.06)'
        }}>
          {/* Order Details & Image Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '28px', alignItems: 'center' }}>
            {/* Image Box */}
            {order.productImage && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div 
                  onClick={() => setLightboxOpen(true)}
                  style={{ 
                    position: 'relative', 
                    width: '100%', 
                    height: '240px', 
                    borderRadius: '8px', 
                    overflow: 'hidden', 
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.01)',
                    cursor: 'zoom-in',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <img 
                    src={order.productImage} 
                    alt={order.productName} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    background: 'rgba(0,0,0,0.78)',
                    color: '#fff',
                    fontSize: '0.62rem',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    letterSpacing: '0.05em',
                    fontWeight: 'bold',
                    fontFamily: 'monospace'
                  }}>
                    🔍 VIEW LARGER
                  </div>
                </div>
              </div>
            )}

            {/* Order Details list */}
            <div style={{
              display: 'grid',
              gap: '12px',
              fontSize: '0.8rem',
              background: 'rgba(255,255,255,0.02)',
              padding: '16px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.03)'
            }}>
              <div>
                <span style={{ color: '#666', display: 'block', fontSize: '0.7rem', letterSpacing: '0.05em' }}>ORDER REFERENCE</span>
                <strong style={{ color: '#fff', fontSize: '0.9rem' }}>#RD-{order.id}</strong>
              </div>
              <div>
                <span style={{ color: '#666', display: 'block', fontSize: '0.7rem', letterSpacing: '0.05em' }}>PRODUCT NAME</span>
                <strong style={{ color: '#fff', fontSize: '0.88rem' }}>{order.productName}</strong>
              </div>
              <div>
                <span style={{ color: '#666', display: 'block', fontSize: '0.7rem', letterSpacing: '0.05em' }}>COLOR / SPECS</span>
                <strong style={{ color: '#10b981' }}>{order.selectedColor}</strong>
              </div>
              <div>
                <span style={{ color: '#666', display: 'block', fontSize: '0.7rem', letterSpacing: '0.05em' }}>SIZE / QUANTITY</span>
                <strong style={{ color: '#fff' }}>Size {order.selectedSize}</strong>
              </div>
              <div>
                <span style={{ color: '#666', display: 'block', fontSize: '0.7rem', letterSpacing: '0.05em' }}>ORDER PRICE</span>
                <strong style={{ color: '#fff' }}>GH₵{order.price}</strong>
              </div>
              <div>
                <span style={{ color: '#666', display: 'block', fontSize: '0.7rem', letterSpacing: '0.05em' }}>SHIPMENT STATUS</span>
                <strong style={{ color: getStatusColor(order.status) }}>{order.status.toUpperCase()}</strong>
              </div>
            </div>
          </div>

          {/* Stepper progress timeline */}
          {stepIndex >= 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', padding: '0 10px' }}>
                {/* Horizontal Bar */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '20px',
                  right: '20px',
                  height: '2px',
                  background: 'rgba(255,255,255,0.08)',
                  zIndex: 1
                }} />
                
                {/* Active progress indicator line */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '20px',
                  width: `${(stepIndex / 3) * 100}%`,
                  height: '2px',
                  background: '#10b981',
                  transition: 'width 0.4s ease-out',
                  zIndex: 2
                }} />

                {['Placed', 'Processing', 'Shipped', 'Delivered'].map((step, idx) => {
                  const isPast = idx <= stepIndex;
                  const isCurrent = idx === stepIndex;
                  return (
                    <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 3, position: 'relative' }}>
                      <div style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: isPast ? '#10b981' : '#111',
                        border: `2px solid ${isPast ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isPast ? '#000' : '#888',
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        boxShadow: isCurrent ? '0 0 12px #10b981' : 'none',
                        transition: 'all 0.3s'
                      }}>
                        {isPast ? '✓' : idx + 1}
                      </div>
                      <span style={{
                        marginTop: '8px',
                        fontSize: '0.65rem',
                        color: isCurrent ? '#10b981' : isPast ? '#fff' : '#666',
                        fontWeight: isCurrent ? 'bold' : 'normal',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox full-screen modal */}
      {lightboxOpen && order && (
        <div 
          onClick={() => setLightboxOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.96)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <img 
            src={order.productImage} 
            alt={order.productName} 
            style={{ 
              maxWidth: '92vw', 
              maxHeight: '92vh', 
              borderRadius: '8px', 
              objectFit: 'contain',
              border: '1.5px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.95)'
            }} 
          />
        </div>
      )}
    </div>
  );
}
