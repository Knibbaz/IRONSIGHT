// Many news sites embed their publish date in the URL itself (WordPress-style
// permalinks: /YYYY/MM/DD/slug or /YYYY/MM/slug). Google News' RSS `pubDate`
// sometimes reflects a crawl/re-index date instead of the true publish date
// (common for lower-traffic or republished articles), which makes stale
// stories show up as "4h ago". Cross-checking against the URL catches this.

const URL_DATE_RE = /\/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})(?:[\/-]|$)/;
const URL_YEAR_MONTH_RE = /\/(20\d{2})[\/-](\d{1,2})[\/-]/;

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
