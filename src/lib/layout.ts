'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Layout } from 'react-grid-layout';

const STORAGE_KEY = 'ironsight-dashboard-layout-v1';
const MOBILE_ORDER_KEY = 'ironsight-dashboard-mobile-order-v1';

// Vertical resolution of the grid — fine enough that "make it bigger" via the
// resize handle feels smooth, while still lining up with the 3 visual rows.
export const ROW_UNITS = 40;
export const COLS = 12;

// Below this width the grid collapses to a single scrollable column.
export const MOBILE_BREAKPOINT = 768;
// On phones the grid no longer tries to fit one screen — each panel gets a
// fixed height and the page scrolls.
export const MOBILE_ROW_HEIGHT = 20; // px
export const MOBILE_PANEL_H = 16; // grid units per stacked panel (~320px)

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
  { i: 'commercial', x: 6, y: 28, w: 3, h: 12, minW: 2, minH: 6 },
  { i: 'crypto', x: 9, y: 28, w: 3, h: 12, minW: 2, minH: 6 },
  { i: 'oil', x: 0, y: 40, w: 3, h: 12, minW: 2, minH: 6 },
  { i: 'satellite', x: 3, y: 40, w: 3, h: 12, minW: 2, minH: 6 },
];

function isValidLayout(parsed: unknown): parsed is Layout[] {
  if (!Array.isArray(parsed)) return false;
  if (parsed.length !== DEFAULT_LAYOUT.length) return false;
  const ids = new Set(parsed.map((p) => (p as Layout)?.i));
  return DEFAULT_LAYOUT.every((d) => ids.has(d.i));
}

// Reading order of the default desktop layout: top-to-bottom, then left-to-right.
export const DEFAULT_MOBILE_ORDER: string[] = [...DEFAULT_LAYOUT]
  .sort((a, b) => a.y - b.y || a.x - b.x)
  .map((l) => l.i);

// Turn an ordered list of panel ids into a single-column react-grid-layout.
export function buildMobileLayout(order: string[]): Layout[] {
  return order.map((id, idx) => ({
    i: id,
    x: 0,
    y: idx * MOBILE_PANEL_H,
    w: 1,
    h: MOBILE_PANEL_H,
    minW: 1,
    maxW: 1,
    minH: 6,
  }));
}

function isValidOrder(parsed: unknown): parsed is string[] {
  if (!Array.isArray(parsed)) return false;
  if (parsed.length !== DEFAULT_LAYOUT.length) return false;
  const ids = new Set(DEFAULT_LAYOUT.map((d) => d.i));
  const seen = new Set<string>();
  for (const id of parsed) {
    if (typeof id !== 'string' || !ids.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

/** Tracks whether the viewport is narrow enough to use the stacked layout. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isMobile;
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
  { id: 'commercial', label: 'Commercial Flights' },
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
  const [mobileOrder, setMobileOrderState] = useState<string[]>(DEFAULT_MOBILE_ORDER);

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
      const storedOrder = localStorage.getItem(MOBILE_ORDER_KEY);
      if (storedOrder) {
        const parsed = JSON.parse(storedOrder);
        if (isValidOrder(parsed)) setMobileOrderState(parsed);
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

  // RGL hands us only the visible items on mobile; derive the new order from
  // their vertical position and keep any hidden panels parked at the end.
  const onMobileLayoutChange = useCallback((next: Layout[]) => {
    setMobileOrderState((prev) => {
      const visibleOrder = [...next].sort((a, b) => a.y - b.y).map((l) => l.i);
      const parked = prev.filter((id) => !visibleOrder.includes(id));
      const order = [...visibleOrder, ...parked];
      if (!isValidOrder(order)) return prev;
      try { localStorage.setItem(MOBILE_ORDER_KEY, JSON.stringify(order)); } catch { /* ignore */ }
      return order;
    });
  }, []);

  const reset = useCallback(() => {
    setLayoutState(DEFAULT_LAYOUT);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setMobileOrderState(DEFAULT_MOBILE_ORDER);
    try { localStorage.removeItem(MOBILE_ORDER_KEY); } catch { /* ignore */ }
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

  return { layout, onLayoutChange, mobileOrder, onMobileLayoutChange, reset, hidden, togglePanel };
}
