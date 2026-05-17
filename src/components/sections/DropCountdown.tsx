'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Drop } from '@/types/product';
import styles from './HomeSections.module.css';

function getTimeRemaining(target: string) {
  const total = Math.max(new Date(target).getTime() - Date.now(), 0);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  const seconds = Math.floor((total / 1000) % 60);

  return { days, hours, minutes, seconds };
}

interface DropCountdownProps {
  drop: Drop;
}

export function DropCountdown({ drop }: DropCountdownProps) {
  const [remaining, setRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [status, setStatus] = useState('');
  const boxes = useMemo(
    () => [
      ['Days', remaining.days],
      ['Hours', remaining.hours],
      ['Min', remaining.minutes],
      ['Sec', remaining.seconds]
    ],
    [remaining]
  );

  useEffect(() => {
    if (!drop) return;
    // Immediately calculate time remaining on mount to avoid 1-second delay
    setRemaining(getTimeRemaining(drop.releaseDate));

    const timer = window.setInterval(() => setRemaining(getTimeRemaining(drop.releaseDate)), 1000);
    return () => window.clearInterval(timer);
  }, [drop]);

  if (!drop) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '');

    const response = await fetch('/api/waitlist', {
      body: JSON.stringify({ email, drop: drop.slug }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });

    setStatus(response.ok ? 'You are on the list.' : 'Check the email and try again.');
    if (response.ok) {
      event.currentTarget.reset();
    }
  };

  return (
    <section className={styles.drop}>
      <div className={styles.dropInner}>
        <div>
          <p className="eyebrow">Upcoming drop</p>
          <h2 className="sectionTitle">{drop.name}</h2>
          <p className="sectionCopy">{drop.summary}</p>
          <div aria-label="Drop countdown" className={styles.countdown}>
            {boxes.map(([label, value]) => (
              <div className={styles.timeBox} key={label}>
                <span className={styles.timeValue}>{String(value).padStart(2, '0')}</span>
                <span className={styles.timeLabel}>{label}</span>
              </div>
            ))}
          </div>
          <form className={styles.newsletter} onSubmit={handleSubmit}>
            <label className="srOnly" htmlFor="drop-email">
              Email address
            </label>
            <input id="drop-email" name="email" placeholder="email@domain.com" required type="email" />
            <Button type="submit">Notify me</Button>
          </form>
          {status ? <p aria-live="polite" className="sectionCopy">{status}</p> : null}
        </div>
        <div className={styles.dropMedia}>
          <Image alt={drop.summary} fill sizes="(min-width: 1024px) 45vw, 100vw" src={drop.image} />
        </div>
      </div>
    </section>
  );
}
