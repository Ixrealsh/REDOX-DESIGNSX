'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_DELIVERY_SETTINGS, FREE_STATION_DELIVERY_DETAILS, FREE_STATION_DELIVERY_LABEL, GHANA_REGIONS, URGENT_STATION_DELIVERY_LABEL, type DeliverySettings } from '@/lib/delivery';
import { formatCurrency } from '@/lib/format';
import styles from './DeliverySettingsPanel.module.css';

const REGIONS = GHANA_REGIONS.filter((region) => region !== 'Greater Accra');

export function DeliverySettingsPanel() {
  const [settings, setSettings] = useState<DeliverySettings>(DEFAULT_DELIVERY_SETTINGS);
  const [feeInput, setFeeInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/admin/delivery-settings', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load delivery settings.');
        return response.json() as Promise<DeliverySettings>;
      })
      .then((saved) => {
        if (cancelled) return;
        setSettings(saved);
        setFeeInput(String(saved.urgentFee));
      })
      .catch((error) => { if (!cancelled) { setLoadError(true); setMessage(error.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggleRegion = (region: string) => {
    setSettings((current) => ({
      ...current,
      eligibleRegions: current.eligibleRegions.includes(region)
        ? current.eligibleRegions.filter((item) => item !== region)
        : [...current.eligibleRegions, region]
    }));
    setMessage('');
  };

  const save = async () => {
    const fee = Number(feeInput);
    if (feeInput.trim() === '' || !Number.isFinite(fee) || fee < 0 || fee > 10000 || Math.abs(Math.round(fee * 100) - fee * 100) > 1e-6) {
      setMessage('Enter a valid urgent fee with up to two decimal places.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/delivery-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eligibleRegions: settings.eligibleRegions, urgentFee: fee })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save delivery settings.');
      setSettings(data);
      setFeeInput(String(data.urgentFee));
      setMessage('Delivery options saved. Customers will see them at checkout.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save delivery settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="delivery-settings-title">
      <h2 id="delivery-settings-title">Delivery options</h2>
      <p>Choose where customers see free or urgent delivery to station. Greater Accra is always excluded.</p>
      {loading ? <p>Loading delivery settings…</p> : loadError ? <div role="alert"><p>{message}</p><button className={styles.save} onClick={() => window.location.reload()} type="button">Retry loading</button></div> : <>
        <div className={styles.info}>{FREE_STATION_DELIVERY_LABEL}: no delivery fee. {FREE_STATION_DELIVERY_DETAILS}</div>
        <label className={styles.feeLabel} htmlFor="urgent-delivery-fee">{URGENT_STATION_DELIVERY_LABEL} extra fee (GH₵)</label>
        <input
          id="urgent-delivery-fee"
          min="0"
          max="10000"
          step="0.01"
          type="number"
          value={feeInput}
          onChange={(event) => { setFeeInput(event.target.value); setMessage(''); }}
        />
        <p className={styles.helper}>
          {Number(feeInput) > 0
            ? `Customers choosing ${URGENT_STATION_DELIVERY_LABEL} pay ${formatCurrency(Number(feeInput))} extra.`
            : `Set an amount above zero to offer ${URGENT_STATION_DELIVERY_LABEL}.`}
        </p>
        <div className={styles.regionHeader}>
          <h3>Regions with these options</h3>
          <div>
            <button type="button" onClick={() => setSettings((current) => ({ ...current, eligibleRegions: [...REGIONS] }))}>Select all</button>
            <button type="button" onClick={() => setSettings((current) => ({ ...current, eligibleRegions: [] }))}>Clear</button>
          </div>
        </div>
        <div className={styles.regions}>
          {REGIONS.map((region) => (
            <label key={region}>
              <input type="checkbox" checked={settings.eligibleRegions.includes(region)} onChange={() => toggleRegion(region)} />
              {region}
            </label>
          ))}
        </div>
        {message && <p className={styles.message} role="status">{message}</p>}
        <button className={styles.save} disabled={saving} onClick={save} type="button">
          {saving ? 'Saving…' : 'Save delivery options'}
        </button>
      </>}
    </section>
  );
}
