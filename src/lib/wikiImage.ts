// Fetch a representative photo for a ship/aircraft from Wikipedia's public REST
// API (CORS-enabled, no key). For each title candidate it tries a direct page
// summary first, then falls back to a title search to resolve a messy string
// (e.g. an ADS-B type like "BOEING C-17A Globemaster III") to a real article.
// Results are cached for the session.

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function absolutize(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('//') ? `https:${url}` : url;
}

async function summaryImage(title: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === 'disambiguation') return null;
    return absolutize(data.thumbnail?.source || data.originalimage?.source);
  } catch {
    return null;
  }
}

async function searchImage(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=1`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const page = data.pages?.[0];
    if (!page) return null;
    // Resolve the canonical article for a full-size image; fall back to the
    // small search thumbnail if the summary call yields nothing.
    return (await summaryImage(page.key || page.title)) || absolutize(page.thumbnail?.url);
  } catch {
    return null;
  }
}

async function resolve(title: string): Promise<string | null> {
  const key = title.trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    try {
      return (await summaryImage(key)) || (await searchImage(key));
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  const result = await p;
  cache.set(key, result);
  return result;
}

export async function fetchWikiImage(candidates: string[]): Promise<string | null> {
  for (const c of candidates) {
    const url = await resolve(c);
    if (url) return url;
  }
  return null;
}
