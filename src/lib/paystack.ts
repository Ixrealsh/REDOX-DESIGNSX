/**
 * Dynamically loads the Paystack Pop secure inline script with cache-busting.
 * Returns a promise that resolves to the PaystackPop instance or null if it fails.
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

    // Inject fresh script tag with a cache-busting timestamp to bypass bad caches/CDN issues
    const script = document.createElement('script');
    script.src = `https://js.paystack.co/v1/inline.js?cb=${Date.now()}`;
    script.async = true;
    
    script.onload = () => {
      const instance = (window as any).PaystackPop || (window as any).Paystack;
      if (instance) {
        resolve(instance);
      } else {
        console.error('Paystack script loaded but window.PaystackPop is undefined.');
        resolve(null);
      }
    };

    script.onerror = () => {
      console.error('Network error loading Paystack inline script.');
      resolve(null);
    };

    document.head.appendChild(script);
  });
}
