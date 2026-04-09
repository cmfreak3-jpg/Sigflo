/**
 * Collapse CDN/HTML error pages into a short hint for UI and thrown Error messages.
 */
export function sanitizeUserFacingHttpErrorMessage(message: string): string {
  const t = message.trim();
  if (t.length === 0) return t;
  if (
    /<\s*!doctype/i.test(t) ||
    /<\s*html\b/i.test(t) ||
    (t.includes('CloudFront') && t.includes('could not be satisfied')) ||
    (/\b403\s+ERROR\b/i.test(t) && t.includes('could not be satisfied'))
  ) {
    return (
      'HTTP 403 — something returned an HTML error page (e.g. CloudFront) instead of JSON. ' +
      'If this is under an exchange on Profile, your hosted backend (e.g. Railway) is calling Bybit/MEXC — add that server’s outbound public IP to the API key’s IP allowlist, or use no IP restriction while testing; some regions are also blocked at the exchange edge. ' +
      'If this appears when the whole page fails to load data, check Netlify env VITE_BACKEND_API_BASE points at your API (host only, no /api suffix) and that /api works on that host.'
    );
  }
  return message;
}
