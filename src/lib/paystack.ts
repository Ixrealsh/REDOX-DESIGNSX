/**
 * Dynamically loads the Paystack Pop secure inline script if not already present in the window.
 * Returns a promise that resolves to the PaystackPop instance or null if it fails.
 */
export function loadPaystackScript(): Promise<any> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }

    if ((window as any).PaystackPop) {
      resolve((window as any).PaystackPop);
      return;
    }

    // Check if script is already in the document but not loaded yet
    const existingScript = document.querySelector('script[src*="paystack.co"]');
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if ((window as any).PaystackPop) {
          clearInterval(checkInterval);
          resolve((window as any).PaystackPop);
        }
      }, 100);

      // Timeout fallback after 6 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve((window as any).PaystackPop || null);
      }, 6000);
      return;
    }

    // Inject the script dynamically
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => {
      resolve((window as any).PaystackPop);
    };
    script.onerror = () => {
      console.error('Failed to load Paystack inline payment script.');
      resolve(null);
    };
    document.head.appendChild(script);
  });
}
