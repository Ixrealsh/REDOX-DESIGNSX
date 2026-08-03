/**
 * Resolves the public origin of the running site.
 *
 * Used for the Paystack `callback_url` and for the track-order link embedded in
 * the transaction metadata, both of which must be absolute. Falls back through
 * the configured site URL, then the platform-provided host, then the request's
 * own headers.
 */
export function resolveSiteUrl(request?: Request): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');

  const vercelUrl = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '').trim();
  if (vercelUrl) {
    return vercelUrl.startsWith('http') ? vercelUrl.replace(/\/+$/, '') : `https://${vercelUrl}`;
  }

  if (request) {
    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (forwardedHost) {
      const proto = request.headers.get('x-forwarded-proto') || (forwardedHost.startsWith('localhost') ? 'http' : 'https');
      return `${proto}://${forwardedHost}`.replace(/\/+$/, '');
    }

    try {
      return new URL(request.url).origin;
    } catch {
      /* fall through */
    }
  }

  return 'https://redoxdesignx.com';
}
