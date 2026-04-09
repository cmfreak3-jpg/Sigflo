function isHtmlOrCdnErrorBody(d: string): boolean {
  return (
    /<\s*!doctype/i.test(d) ||
    /<\s*html\b/i.test(d) ||
    (d.includes('CloudFront') && d.includes('could not be satisfied')) ||
    (/\b403\s+ERROR\b/i.test(d) && d.includes('could not be satisfied'))
  );
}

/**
 * Avoid stuffing CloudFront/HTML error pages into Error.message (first 400 chars still break UI).
 * @param requestUrl Optional fetch URL so we can tailor hints (e.g. Bybit IP allowlist).
 */
export function sanitizeHttpErrorDetail(detail: string, requestUrl?: string): string {
  const d = detail.trim();
  if (d.length === 0) return '';
  if (!isHtmlOrCdnErrorBody(d)) {
    return d.length > 400 ? d.slice(0, 400) : d;
  }
  const u = requestUrl ?? '';
  if (u.includes('bybit.com')) {
    return (
      'Bybit edge returned HTML (blocked/error page), not API JSON. ' +
      'Typical fixes: add your backend host’s outbound public IP to the Bybit key IP allowlist (Railway: check docs for static egress / outbound IP), or temporarily use no IP restriction; ' +
      'also confirm the server region is not blocked by Bybit.'
    );
  }
  if (u.includes('mexc.com')) {
    return (
      'MEXC returned HTML instead of JSON. Check API key IP allowlist includes your backend egress IP and region restrictions.'
    );
  }
  return (
    'HTML/CDN error page, not exchange JSON. Check API host, WAF/geo rules, and API key IP allowlist for your server egress IP.'
  );
}
