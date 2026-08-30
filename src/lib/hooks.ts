import { useState, useEffect, useCallback } from 'react';
import { useConflict } from './conflicts/context';
import { useLanguage } from './language/context';

export function useDataFeed<T>(url: string, interval: number = 60000, initialData: T | null = null) {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Cache-bust to ensure fresh data on each poll
      const bustUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
      const res = await fetch(bustUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Keep previous data if new response is empty (likely rate limited)
      const isEmpty = Array.isArray(json) ? json.length === 0 :
                      json && typeof json === 'object' && 'posts' in json ? json.posts?.length === 0 : false;
      if (!isEmpty || !data) {
        setData(json);
      }
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, interval);
    return () => clearInterval(id);
  }, [fetchData, interval]);

  return { data, loading, error, lastUpdated, refetch: fetchData };
}

/**
 * Like useDataFeed, but automatically appends the active conflict as a
 * `?conflict=<key>` query param, and the active UI language as `&lang=<lang>`.
 * When the user toggles conflicts or language the URL changes, so the feed
 * re-fetches for the newly selected theater/language.
 */
export function useConflictFeed<T>(path: string, interval: number = 60000, initialData: T | null = null) {
  const { key } = useConflict();
  const { lang } = useLanguage();
  const url = `${path}${path.includes('?') ? '&' : '?'}conflict=${key}&lang=${lang}`;
  return useDataFeed<T>(url, interval, initialData);
}

/** Forces a re-render every `ms` milliseconds so relative timestamps stay fresh. */
export function useTick(ms: number = 15000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

const READ_KEY = 'ironsight:read-items';
const READ_CAP = 2000;

/**
 * Tracks which feed items the user has already opened. Read URLs are persisted
 * in localStorage (keyed by link) so the state survives reloads. Unread items
 * can be highlighted while read ones are dimmed.
 */
export function useReadItems() {
  const [read, setRead] = useState<Set<string>>(new Set());

  // Load persisted read items after mount to avoid hydration mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(READ_KEY);
      if (raw) setRead(new Set(JSON.parse(raw)));
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  // Persist the set whenever it changes.
  useEffect(() => {
    try {
      window.localStorage.setItem(READ_KEY, JSON.stringify([...read]));
    } catch {
      /* storage full/unavailable */
    }
  }, [read]);

  const markRead = useCallback((url?: string) => {
    if (!url) return;
    setRead(prev => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      if (next.size > READ_CAP) {
        const arr = [...next];
        next.clear();
        for (const u of arr.slice(-READ_CAP)) next.add(u);
      }
      return next;
    });
  }, []);

  const isRead = useCallback((url?: string) => (url ? read.has(url) : false), [read]);

  const clearRead = useCallback(() => {
    setRead(new Set());
    try {
      window.localStorage.removeItem(READ_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { isRead, markRead, readCount: read.size, clearRead };
}

export function timeAgo(date: string | Date): string {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);

  // Invalid date
  if (isNaN(then.getTime())) return '';

  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  const abs = Math.abs(seconds);

  if (abs < 60) return 'just now';
  if (abs < 3600) return `${Math.floor(abs / 60)}m ago`;
  if (abs < 86400) return `${Math.floor(abs / 3600)}h ago`;
  return `${Math.floor(abs / 86400)}d ago`;
}

export function formatPrice(price: number, decimals: number = 2): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatChange(change: number, percent: number): string {
  const c = change ?? 0;
  const p = percent ?? 0;
  const sign = c >= 0 ? '+' : '';
  return `${sign}${c.toFixed(2)} (${sign}${p.toFixed(2)}%)`;
}
