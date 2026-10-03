'use client';

import { useState, type FormEvent } from 'react';
import type { Order } from '@/types/product';
import { formatGhanaPhone, isValidGhanaPhone } from '@/lib/phone';
import styles from './Admin.module.css';

interface SmsOrderEditorProps {
  order: Order;
  onClose: () => void;
  onSaved: (order: Order, message: string, sent: boolean) => void;
}

export function SmsOrderEditor({ order, onClose, onSaved }: SmsOrderEditorProps) {
  const [phone, setPhone] = useState(order.customerPhone);
  const [sendSms, setSendSms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPhone = phone.trim();
    if (nextPhone.length < 8) {
      setError('Enter a phone number with at least 8 characters.');
      return;
    }
    if (sendSms && !isValidGhanaPhone(formatGhanaPhone(nextPhone))) {
      setError('Enter a valid Ghanaian phone number before sending SMS.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateSms', orderId: order.id, customerPhone: nextPhone, sendSms })
      });
      const data = await response.json();
      if (!response.ok || !data.order) throw new Error(data.error || 'Could not save SMS details.');
      onSaved(data.order as Order, data.message, data.smsSent === true);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save SMS details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <div aria-labelledby="sms-editor-title" aria-modal="true" className={`${styles.modalContent} ${styles.smsEditor}`} role="dialog">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle} id="sms-editor-title">SMS · Order #RD-{order.id}</h2>
          <button aria-label="Close SMS editor" className={styles.closeButton} disabled={saving} onClick={onClose} type="button">×</button>
        </div>
        <form className={styles.smsEditorForm} onSubmit={handleSave}>
          <p className={styles.smsEditorStatus}>
            {order.smsSent ? 'Confirmation SMS sent.' : 'SMS not sent. You can save the number and send whenever you are ready.'}
          </p>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Customer phone number</span>
            <input autoFocus className={styles.input} inputMode="tel" onChange={(event) => setPhone(event.target.value)} required type="tel" value={phone} />
          </label>
          <label className={styles.smsEditorChoice}>
            <input checked={sendSms} onChange={(event) => setSendSms(event.target.checked)} type="checkbox" />
            <span>
              <strong>Send confirmation SMS now</strong>
              <small>{order.smsSent ? 'This will send another confirmation text.' : 'Leave unchecked to save the number and send later.'}</small>
            </span>
          </label>
          {error && <p className={styles.smsEditorError} role="alert">{error}</p>}
          <div className={styles.smsEditorActions}>
            <button className={styles.cancelButton} disabled={saving} onClick={onClose} type="button">Cancel</button>
            <button className={styles.saveButton} disabled={saving} type="submit">{saving ? 'Saving…' : sendSms ? 'Save & send SMS' : 'Save number'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
