'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Layout } from 'react-grid-layout';

const STORAGE_KEY = 'ironsight-dashboard-layout-v1';

// Vertical resolution of the grid — fine enough that "make it bigger" via the
// resize handle feels smooth, while still lining up with the 3 visual rows.
export const ROW_UNITS = 40;
export const COLS = 12;

// Mirrors the original fixed 3-row layout (2fr / 1.5fr / 1.5fr => 16/12/12 units).
export const DEFAULT_LAYOUT: Layout[] = [
  { i: 'news', x: 0, y: 0, w: 3, h: 16, minW: 2, minH: 6 },
  { i: 'map', x: 3, y: 0, w: 4, h: 16, minW: 2, minH: 6 },
  { i: 'alerts', x: 7, y: 0, w: 2, h: 16, minW: 2, minH: 6 },
  { i: 'telegram', x: 9, y: 0, w: 3, h: 16, minW: 2, minH: 6 },
  { i: 'markets', x: 0, y: 16, w: 3, h: 12, minW: 2, minH: 6 },
  { i: 'strikes', x: 3, y: 16, w: 3, h: 12, minW: 2, minH: 6 },
  { i: 'polymarket', x: 6, y: 16, w: 2, h: 12, minW: 2, minH: 6 },
  { i: 'conflictFeed', x: 8, y: 16, w: 2, h: 12, minW: 2, minH: 6 },
  { i: 'flights', x: 10, y: 16, w: 2, h: 12, minW: 2, minH: 6 },
  { i: 'regional', x: 0, y: 28, w: 3, h: 12, minW: 2, minH: 6 },
  { i: 'naval', x: 3, y: 28, w: 3, h: 12, minW: 2, minH: 6 },
  { i: 'crypto', x: 6, y: 28, w: 2, h: 12, minW: 2, minH: 6 },
  { i: 'oil', x: 8, y: 28, w: 2, h: 12, minW: 2, minH: 6 },
  { i: 'satellite', x: 10, y: 28, w: 2, h: 12, minW: 2, minH: 6 },
];

function isValidLayout(parsed: unknown): parsed is Layout[] {
  if (!Array.isArray(parsed)) return false;
  if (parsed.length !== DEFAULT_LAYOUT.length) return false;
  const ids = new Set(parsed.map((p) => (p as Layout)?.i));
  return DEFAULT_LAYOUT.every((d) => ids.has(d.i));
}

// Human-readable names for the "hide/restore panels" menu.
export const PANEL_LABELS: { id: string; label: string }[] = [
  { id: 'news', label: 'Live Intel Feed' },
  { id: 'map', label: 'Theater Map' },
  { id: 'alerts', label: 'Israel Alert Status' },
  { id: 'telegram', label: 'Telegram OSINT' },
  { id: 'markets', label: 'Defense & Markets' },
  { id: 'strikes', label: 'Missile / Strike Tracker' },
  { id: 'polymarket', label: 'Prediction Markets' },
  { id: 'conflictFeed', label: 'Conflict Monitor' },
  { id: 'flights', label: 'Mil Airspace' },
  { id: 'regional', label: 'Regional Threat Monitor' },
  { id: 'naval', label: 'Naval Tracker' },
  { id: 'crypto', label: 'Crypto Markets' },
  { id: 'oil', label: 'Energy Markets' },
  { id: 'satellite', label: 'Sat Thermal Detect' },
];

const HIDDEN_STORAGE_KEY = 'ironsight-dashboard-hidden-v1';

function isValidHidden(parsed: unknown): parsed is string[] {
  if (!Array.isArray(parsed)) return false;
  const ids = new Set(DEFAULT_LAYOUT.map((d) => d.i));
  return parsed.every((id) => typeof id === 'string' && ids.has(id));
}

/**
 * Per-browser dashboard layout (drag position + resize) and panel
 * visibility, persisted to localStorage only. Nothing here is synced
 * anywhere, so other visitors — or this same browser in incognito / after
 * clearing site data — always see the default layout with every panel shown.
 */
export function useDashboardLayout() {
  const [layout, setLayoutState] = useState<Layout[]>(DEFAULT_LAYOUT);
  const [hidden, setHiddenState] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (isValidLayout(parsed)) setLayoutState(parsed);
      }
    } catch {
      // localStorage unavailable or corrupt — stay on default
    }
    try {
      const storedHidden = localStorage.getItem(HIDDEN_STORAGE_KEY);
      if (storedHidden) {
        const parsed = JSON.parse(storedHidden);
        if (isValidHidden(parsed)) setHiddenState(new Set(parsed));
      }
    } catch {
      // localStorage unavailable or corrupt — stay on default
    }
  }, []);

  const onLayoutChange = useCallback((next: Layout[]) => {
    setLayoutState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const reset = useCallback(() => {
    setLayoutState(DEFAULT_LAYOUT);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setHiddenState(new Set());
    try { localStorage.removeItem(HIDDEN_STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const togglePanel = useCallback((id: string) => {
    setHiddenState((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { layout, onLayoutChange, reset, hidden, togglePanel };
}
