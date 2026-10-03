'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './AdminLogin.module.css';

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        window.location.reload();
      } else if (response.status === 403) {
        router.replace('/404');
      } else {
        setError(data?.error || 'Sign in failed. Check your email and password.');
      }
    } catch {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby="admin-login-title">
        <div className={styles.brand}>
          <Image alt="REDOXDESIGNX" className={styles.logo} height={52} src="/assets/icons/redoxlogo.jpg" width={52} />
          <p className={styles.eyebrow}>REDOXDESIGNX</p>
          <h1 id="admin-login-title">Admin sign in</h1>
          <p>Manage products and orders in one place.</p>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <form className={styles.form} onSubmit={handleSubmit}>
          <label htmlFor="admin-email">Email</label>
          <input autoComplete="username" id="admin-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          <label htmlFor="admin-password">Password</label>
          <input autoComplete="current-password" id="admin-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          <button disabled={loading} type="submit">{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </section>
    </div>
  );
}
