'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_DELIVERY_SETTINGS, normalizeDeliverySettings, type DeliverySettings } from '@/lib/delivery';

export function useDeliverySettings() {
  const [settings, setSettings] = useState<DeliverySettings>(DEFAULT_DELIVERY_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/delivery-settings', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Delivery settings unavailable');
        return response.json();
      })
      .then((data) => { if (!cancelled) setSettings(normalizeDeliverySettings(data)); })
      .catch(() => { /* Free station delivery remains available without an extra charge. */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { settings, loading };
}
