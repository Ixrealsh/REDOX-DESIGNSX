'use client';

import { deliveryQuote, type DeliverySettings } from '@/lib/delivery';
import { formatCurrency } from '@/lib/format';
import styles from './DeliveryChoice.module.css';

interface DeliveryChoiceProps {
  region: string;
  method: 'standard' | 'urgent';
  settings: DeliverySettings;
  loading: boolean;
  onChange: (method: 'standard' | 'urgent') => void;
}

export function DeliveryChoice({ region, method, settings, loading, onChange }: DeliveryChoiceProps) {
  if (loading) return <p className={styles.loading}>Checking delivery options…</p>;
  const standard = deliveryQuote(region, 'standard', settings);
  if (standard.method === 'none') return null;
  const urgentAvailable = settings.urgentFee > 0;

  return (
    <fieldset className={styles.group}>
      <legend>Delivery for {region}</legend>
      <label className={`${styles.option} ${method !== 'urgent' ? styles.selected : ''}`}>
        <input type="radio" name="delivery-method" checked={method !== 'urgent'} onChange={() => onChange('standard')} />
        <span><strong>Standard · no extra fee</strong><small>Monday–Friday delivery, within 3 working days. Weekends are excluded.</small></span>
      </label>
      {urgentAvailable && (
        <label className={`${styles.option} ${method === 'urgent' ? styles.selected : ''}`}>
          <input type="radio" name="delivery-method" checked={method === 'urgent'} onChange={() => onChange('urgent')} />
          <span><strong>Urgent · +{formatCurrency(settings.urgentFee)}</strong><small>Priority handling. Our team will confirm the earliest available delivery time.</small></span>
        </label>
      )}
    </fieldset>
  );
}
