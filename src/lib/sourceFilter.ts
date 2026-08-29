// Domains excluded from all news-derived feeds (RSS + Google News aggregation).
// Add a bare hostname (no scheme, no "www.") to block a source everywhere.
const BLOCKED_HOSTNAMES = new Set<string>([
  'newsonair.gov.in',
  'migflug.com', // aviation blog, not a live news source — resurfaces old posts with a fresh Google News crawl date
]);

export function isBlockedSource(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return BLOCKED_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
}
