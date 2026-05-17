/**
 * Dynamically loads the Paystack Pop secure inline script.
 * Features a dual-layered pipeline: attempts to load from the official live CDN first,
 * and automatically falls back to a same-origin local asset copy if blocked by ad-blockers.
 */
export function loadPaystackScript(): Promise<any> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }

    // If already loaded in window, resolve instantly
    if ((window as any).PaystackPop) {
      resolve((window as any).PaystackPop);
      return;
    }
    if ((window as any).Paystack) {
      resolve((window as any).Paystack);
      return;
    }

    // 1. Try loading from the official live CDN first
    const script = document.createElement('script');
    script.src = `https://js.paystack.co/v1/inline.js?cb=${Date.now()}`;
    script.async = true;

    script.onload = () => {
      const instance = (window as any).PaystackPop || (window as any).Paystack;
      if (instance) {
        resolve(instance);
      } else {
        loadLocalFallback(resolve);
      }
    };

    script.onerror = () => {
      console.warn('Paystack live CDN was blocked (e.g. by adblock or firewall). Swapping to same-origin fallback asset...');
      loadLocalFallback(resolve);
    };

    document.head.appendChild(script);
  });
}

/**
 * Loads the same-origin minified Paystack JS asset to bypass ad-blocker restrictions.
 */
function loadLocalFallback(resolve: (value: any) => void) {
  const localScript = document.createElement('script');
  localScript.src = `/assets/js/paystack-inline.js?cb=${Date.now()}`;
  localScript.async = true;

  localScript.onload = () => {
    const instance = (window as any).PaystackPop || (window as any).Paystack;
    if (instance) {
      console.log('Successfully initialized secure same-origin Paystack inline gateway fallback.');
      resolve(instance);
    } else {
      console.error('Failed to locate PaystackPop in same-origin script window space.');
      resolve(null);
    }
  };

  localScript.onerror = () => {
    console.error('Failed to load local Paystack same-origin asset.');
    resolve(null);
  };

  document.head.appendChild(localScript);
}
