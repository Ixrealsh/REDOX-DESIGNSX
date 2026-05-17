'use client';

import { useState } from 'react';
import Image from 'next/image';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Send credentials to local server API endpoint to prevent client-side connection/CORS failures
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        window.location.reload(); // Refresh to trigger page.tsx server check
      } else {
        if (response.status === 403) {
          window.location.href = '/404';
          return;
        }
        setError(data.error || 'Access Denied. Unauthorized admin account.');
      }
    } catch (err: any) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050505',
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        padding: '24px',
        fontFamily: 'var(--font-mono), monospace'
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(10, 10, 10, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '40px 32px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Sleek top glowing border line */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #10b981, transparent)'
          }}
        />

        {/* Brand Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ position: 'relative', width: '56px', height: '56px', margin: '0 auto 16px auto', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <Image 
              src="/assets/icons/redoxlogo.jpg" 
              alt="REDOXDESIGNX Logo" 
              fill
              style={{ objectFit: 'cover' }}
            />
          </div>
          <h2 style={{ fontSize: '0.9rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 'bold', margin: '0 0 8px 0' }}>
            REDOXDESIGNX
          </h2>
          <p style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
            ADMIN ACCESS PORTAL
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div 
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '4px',
              padding: '12px',
              marginBottom: '24px',
              fontSize: '0.75rem',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label 
              style={{
                display: 'block',
                fontSize: '0.7rem',
                color: '#aaa',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '8px'
              }}
            >
              ADMIN EMAIL
            </label>
            <input 
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@redoxdesignx.com"
              style={{
                width: '100%',
                background: '#0c0c0c',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '12px 16px',
                fontSize: '0.8rem',
                color: '#fff',
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#10b981'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
            />
          </div>

          <div>
            <label 
              style={{
                display: 'block',
                fontSize: '0.7rem',
                color: '#aaa',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '8px'
              }}
            >
              PASSWORD
            </label>
            <input 
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                background: '#0c0c0c',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '12px 16px',
                fontSize: '0.8rem',
                color: '#fff',
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#10b981'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            style={{
              background: '#ffffff',
              color: '#000000',
              border: 'none',
              borderRadius: '4px',
              padding: '14px',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s, background-color 0.2s',
              marginTop: '8px',
              fontFamily: 'inherit'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#10b981';
                e.currentTarget.style.color = '#ffffff';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.color = '#000000';
              }
            }}
          >
            {loading ? 'AUTHENTICATING...' : 'SECURE SIGN IN'}
          </button>
        </form>
      </div>
    </div>
  );
}
