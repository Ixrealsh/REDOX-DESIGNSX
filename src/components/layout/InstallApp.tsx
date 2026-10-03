'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import styles from './InstallApp.module.css';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallApp() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [prompting, setPrompting] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIos(/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    setIsSafari(/Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua));
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || 'standalone' in navigator && navigator.standalone === true);

    const onInstallAvailable = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      dialogRef.current?.close();
    };
    window.addEventListener('beforeinstallprompt', onInstallAvailable);
    window.addEventListener('appinstalled', onInstalled);

    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
        // The website remains usable if service workers are blocked by the browser.
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallAvailable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const open = () => dialogRef.current?.showModal();
  const install = async () => {
    if (!promptEvent) return;
    setPrompting(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      if (choice.outcome === 'accepted') dialogRef.current?.close();
    } catch {
      // Some browsers withdraw the prompt after it has been offered.
      setPromptEvent(null);
    } finally {
      setPrompting(false);
    }
  };

  return (
    <>
      <button className={styles.footerButton} onClick={open} type="button">Install app</button>
      <dialog aria-labelledby="install-app-title" className={styles.dialog} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }} onClose={() => setPrompting(false)} ref={dialogRef}>
        <div className={styles.heading}>
          <Image alt="REDOXDESIGNX" className={styles.mark} height={48} src="/icon1?brand=2" unoptimized width={48} />
          <button aria-label="Close install instructions" className={styles.close} onClick={() => dialogRef.current?.close()} type="button">×</button>
        </div>
        <h2 id="install-app-title">REDOX, one tap away.</h2>
        {installed ? (
          <p>REDOXDESIGNX is already installed on this device. Open it from your Home Screen.</p>
        ) : isIos ? (
          <>
            {!isSafari && <p>Open this website in Safari first.</p>}
            <ol>
              <li>Tap <strong>Share</strong> in Safari. On some layouts, tap the page menu, then Share.</li>
              <li>Choose <strong>Add to Home Screen</strong>.</li>
              <li>Turn on <strong>Open as Web App</strong> if shown, then tap <strong>Add</strong>.</li>
            </ol>
          </>
        ) : promptEvent ? (
          <>
            <p>Add REDOXDESIGNX to your Home Screen for quick access.</p>
            <button className={styles.installButton} disabled={prompting} onClick={install} type="button">
              {prompting ? 'Opening install…' : 'Install REDOXDESIGNX'}
            </button>
          </>
        ) : (
          <>
            <p>Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
            <p className={styles.note}>On Android, Chrome usually shows this option in its ⋮ menu.</p>
          </>
        )}
        <p className={styles.note}>Installation is optional. You can always use the website in your browser.</p>
      </dialog>
    </>
  );
}
