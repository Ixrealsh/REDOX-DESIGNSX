'use client';

import { deliveryQuote, FREE_STATION_DELIVERY_DETAILS, FREE_STATION_DELIVERY_LABEL, URGENT_STATION_DELIVERY_LABEL, type DeliverySettings } from '@/lib/delivery';
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
        <span><strong>{FREE_STATION_DELIVERY_LABEL} · no extra fee</strong><small>{FREE_STATION_DELIVERY_DETAILS} Enter your preferred station or town below; our team will confirm the station.</small></span>
      </label>
      {urgentAvailable && (
        <label className={`${styles.option} ${method === 'urgent' ? styles.selected : ''}`}>
          <input type="radio" name="delivery-method" checked={method === 'urgent'} onChange={() => onChange('urgent')} />
          <span><strong>{URGENT_STATION_DELIVERY_LABEL} · +{formatCurrency(settings.urgentFee)}</strong><small>Priority station delivery. Our team will confirm your station and the earliest available time.</small></span>
        </label>
      )}
    </fieldset>
  );
}
