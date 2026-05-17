'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import styles from '@/app/pages.module.css';

export function ContactForm() {
  const [status, setStatus] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('Sending...');
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') || ''),
      email: String(formData.get('email') || ''),
      topic: String(formData.get('topic') || ''),
      message: String(formData.get('message') || '')
    };

    const response = await fetch('/api/contact', {
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });

    setStatus(response.ok ? 'Message received. We will reply within two business days.' : 'Please check the form and try again.');

    if (response.ok) {
      form.reset();
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required />
      </div>
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" required type="email" />
      </div>
      <div className={styles.field}>
        <label htmlFor="topic">Topic</label>
        <select id="topic" name="topic" required defaultValue="Order support">
          <option>Order support</option>
          <option>Sizing</option>
          <option>Press</option>
          <option>Wholesale</option>
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="message">Message</label>
        <textarea id="message" name="message" required />
      </div>
      <Button type="submit">Send message</Button>
      {status ? (
        <p aria-live="polite" className={styles.status}>
          {status}
        </p>
      ) : null}
    </form>
  );
}
