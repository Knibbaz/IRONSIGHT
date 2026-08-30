// Many news sites embed their publish date in the URL itself (WordPress-style
// permalinks: /YYYY/MM/DD/slug or /YYYY/MM/slug). Google News' RSS `pubDate`
// sometimes reflects a crawl/re-index date instead of the true publish date
// (common for lower-traffic or republished articles), which makes stale
// stories show up as "4h ago". Cross-checking against the URL catches this.

import { fetchWithTimeout } from './fetcher';

const URL_DATE_RE = /\/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})(?:[\/-]|$)/;
const URL_YEAR_MONTH_RE = /\/(20\d{2})[\/-](\d{1,2})[\/-]/;
const URL_COMPACT_DATE_RE = /(?:^|[^\d])(20\d{2})(\d{2})(\d{2})(?:[^\d]|$)/;

export function extractDateFromUrl(url: string): Date | null {
  if (!url) return null;

  let match = url.match(URL_DATE_RE);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  match = url.match(URL_COMPACT_DATE_RE);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  match = url.match(URL_YEAR_MONTH_RE);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    if (month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month - 1, 1));
    }
  }

  return null;
}

/**
 * Prefer the URL-embedded publish date over the feed's reported date when
 * they disagree by more than a few days — the feed date is almost always the
 * one that's wrong (a fresher crawl/re-index timestamp on an older article).
 * Returns an ISO string either way.
 */
export function reconcilePubDate(pubDate: string, url: string): string {
  const urlDate = extractDateFromUrl(url);
  if (!urlDate) return pubDate;

  const feedDate = new Date(pubDate);
  if (isNaN(feedDate.getTime())) return urlDate.toISOString();

  const diffDays = (feedDate.getTime() - urlDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 3) return urlDate.toISOString();

  return pubDate;
}

// --- Deep reconciliation: read the article's own metadata --------------------
// When the URL carries no date, the only remaining ground truth is the page
// itself. Publishers almost universally expose the publish date in a handful of
// well-known meta tags / JSON-LD fields. We only ever use it to move a date
// *backwards* (an old story wearing a fresh crawl timestamp), never forwards.

const META_DATE_PATTERNS: RegExp[] = [
  /<meta[^>]+(?:property|name)=["'](?:article:published_time|og:article:published_time|og:published_time|publish-date|publishdate|pubdate|date|datepublished|dc\.date\.issued|dcterms\.date|dcterms\.created|parsely-pub-date|sailthru\.date)["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:article:published_time|og:article:published_time|og:published_time|publish-date|publishdate|pubdate|date|datepublished|dc\.date\.issued|dcterms\.date|dcterms\.created|parsely-pub-date|sailthru\.date)["']/i,
  /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
  /<time[^>]+(?:datetime|pubdate)=["']([^"']+)["']/i,
  /<article[^>]+data-date=["']([^"']+)["']/i,
];

const JSON_LD_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const JSON_DATE_KEYS = ['datePublished', 'uploadDate', 'publishDate', 'dateCreated', 'pubDate'];

/** Recursively walk parsed JSON-LD looking for a publish date. */
function findDateInJson(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findDateInJson(item);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    for (const key of JSON_DATE_KEYS) {
      const v = obj[key];
      if (typeof v === 'string' && v.trim() && !isNaN(new Date(v.trim()).getTime())) return v.trim();
    }
    for (const v of Object.values(obj)) {
      const found = findDateInJson(v);
      if (found) return found;
    }
  }
  return null;
}

function parseJsonLdDate(html: string): string | null {
  const blocks = html.match(JSON_LD_RE) || [];
  for (const block of blocks) {
    const raw = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    try {
      const found = findDateInJson(JSON.parse(raw));
      if (found) return found;
    } catch {
      /* malformed JSON-LD — try the next block */
    }
  }
  return null;
}

function isValidPublishDate(d: Date): boolean {
  if (isNaN(d.getTime())) return false;
  const year = d.getUTCFullYear();
  if (year < 2015 || d.getTime() > Date.now() + 2 * 24 * 60 * 60 * 1000) return false;
  return true;
}

export function parsePublishDateFromHtml(html: string): string | null {
  // JSON-LD is the most reliable signal; try it first.
  const jsonLd = parseJsonLdDate(html);
  if (jsonLd) {
    const d = new Date(jsonLd);
    if (isValidPublishDate(d)) return d.toISOString();
  }

  for (const re of META_DATE_PATTERNS) {
    const m = html.match(re);
    if (!m) continue;
    const d = new Date(m[1].trim());
    if (!isValidPublishDate(d)) continue;
    return d.toISOString();
  }
  return null;
}

/**
 * Best-effort fetch of the article page. Returns the parsed publish date (if
 * any) plus the final URL after redirects — some publishers bounce short-links
 * to a canonical /YYYY/MM/DD/ permalink, which is a fallback ground truth even
 * when the page carries no machine-readable date.
 */
async function fetchArticlePublishDate(
  url: string,
  timeoutMs: number
): Promise<{ real: string | null; finalUrl: string | null }> {
  try {
    const res = await fetchWithTimeout(url, {
      timeout: timeoutMs,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        // Google's consent cookie so short-links (news.google.com/...) don't
        // bounce to a consent wall before reaching the publisher.
        'Cookie': 'SOCS=CAI',
      },
    });
    const finalUrl = res.url || null;
    if (!res.ok) return { real: null, finalUrl };
    const ct = res.headers.get('content-type') || '';
    if (ct && !/html|xml/i.test(ct)) return { real: null, finalUrl };
    const html = (await res.text()).slice(0, 250_000);
    return { real: parsePublishDateFromHtml(html), finalUrl };
  } catch {
    return { real: null, finalUrl: null };
  }
}

const RECENT_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;
const STALE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Batch variant of {@link reconcilePubDate} that additionally fetches the
 * article page for items still claiming to be fresh after the URL check.
 * Mutates each item in place via `set`. Best-effort: any fetch failure leaves
 * the original date untouched. Concurrency-bounded so a feed route never fans
 * out into hundreds of simultaneous requests.
 */
export async function deepReconcileDates<T>(
  items: T[],
  get: (item: T) => { pubDate: string; url: string },
  set: (item: T, isoDate: string) => void,
  opts: { concurrency?: number; timeoutMs?: number } = {}
): Promise<void> {
  const concurrency = opts.concurrency ?? 8;
  const timeoutMs = opts.timeoutMs ?? 4000;
  const now = Date.now();

  const needsFetch: T[] = [];
  for (const item of items) {
    const { pubDate, url } = get(item);
    const synced = reconcilePubDate(pubDate, url);
    if (synced !== pubDate) {
      set(item, synced);
      continue;
    }
    if (!/^https?:\/\//i.test(url || '')) continue;
    if (extractDateFromUrl(url)) continue; // URL had a date; already trusted above
    const feedTime = new Date(pubDate).getTime();
    if (isNaN(feedTime) || now - feedTime > RECENT_WINDOW_MS) continue; // not claiming to be fresh
    needsFetch.push(item);
  }

  let cursor = 0;
  const worker = async () => {
    while (cursor < needsFetch.length) {
      const item = needsFetch[cursor++];
      const { pubDate, url } = get(item);
      const { real, finalUrl } = await fetchArticlePublishDate(url, timeoutMs);
      const feedTime = new Date(pubDate).getTime();

      // Even without machine-readable metadata, the post-redirect URL may be a
      // canonical /YYYY/MM/DD/ permalink — use that to correct stale dates.
      if (!real && finalUrl) {
        const urlDate = extractDateFromUrl(finalUrl);
        if (urlDate && !isNaN(feedTime) && feedTime - urlDate.getTime() > STALE_THRESHOLD_MS) {
          set(item, urlDate.toISOString());
          continue;
        }
      }

      if (!real) continue;
      const realTime = new Date(real).getTime();
      if (!isNaN(feedTime) && feedTime - realTime > STALE_THRESHOLD_MS) {
        set(item, real);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, needsFetch.length) }, worker)
  );
}
