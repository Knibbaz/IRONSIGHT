import { NextResponse } from 'next/server';

import { fetchWithTimeout } from '@/lib/fetcher';
import { getConflictFromRequest } from '@/lib/conflicts';
import type { AirportRef } from '@/lib/conflicts/types';

export const dynamic = 'force-dynamic';

// Airport disruption monitor — keyless.
//
// There is no free flight-status API, so instead of "delays / cancellations"
// this derives an airspace-health signal for a handful of regional hub
// airports straight from ADS-B (adsb.lol): are arrivals still landing, are
// departures still climbing out, is anyone holding or going around, is the
// apron full while nothing moves. That is exactly what a NOTAM closure, a
// ground stop or a missile-alert airspace clearance looks like from the air.
//
// State is module-level (per server instance). Dev hot-reload resets it, and
// the first ~25 min after a cold start every airport reads WARMUP.

const ADSBL_HEADERS = {
  'User-Agent': 'IronSight/1.0 (OSINT dashboard; https://github.com/NoblerWorks-HQ/IRONSIGHT)',
  Accept: 'application/json',
};

interface AdsbAircraft {
  hex?: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  gs?: number;
}

interface Sample {
  t: number;    // epoch ms
  alt: number;  // feet
  gs: number;   // knots
  dist: number; // nm from the airport
  ground: boolean;
}

type Status = 'WARMUP' | 'DORMANT' | 'NORMAL' | 'BUSY' | 'DISRUPTED' | 'GROUND_STOP' | 'CLOSED';
type Severity = 'none' | 'info' | 'warn' | 'critical';

interface AirportStatus {
  code: string;
  name: string;
  lat: number;
  lon: number;
  status: Status;
  severity: Severity;
  arrivals: number;
  departures: number;
  holding: number;
  goArounds: number;
  onGround: number;
  inbound: number;
  windowMin: number;
  note: string;
  stale: boolean;
  polledAgoSec: number | null;
  updated: string;
}

// key: `${airportCode}:${hex}`
const HISTORY = new Map<string, Sample[]>();
const FIRST_SEEN = new Map<string, number>();   // airport code -> first successful poll
const LAST_POLLED = new Map<string, number>();  // airport code -> last successful poll

const FEED_RADIUS_NM = 60;
const WINDOW_MS = 35 * 60_000;
const HISTORY_TTL_MS = 45 * 60_000;
const MIN_SAMPLE_GAP_MS = 20_000;
const WARMUP_MS = 25 * 60_000;
// adsb.lol asks for <=1 req/s and hard-429s a burst of more than ~5, so we
// cannot sweep a dozen hubs in one shot. Instead each call refreshes a
// rotating GROUP_SIZE slice, one request at a time. HISTORY lives 45 min and
// the route is cached 60 s, so every hub still refreshes every few minutes.
const POOL = 1;
const REQ_STAGGER_MS = 1500;
const GROUP_SIZE = 4;

const SEVERITY_RANK: Record<Severity, number> = { none: 0, info: 1, warn: 2, critical: 3 };

function toFeet(v: number | string | undefined): number {
  if (typeof v === 'number') return v;
  if (v === 'ground') return 0;
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function isGround(v: number | string | undefined): boolean {
  return v === 'ground';
}

function haversineNm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return (2 * R * Math.asin(Math.sqrt(h))) / 1.852;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async (_, w) => {
    await sleep(w * REQ_STAGGER_MS);
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
      await sleep(REQ_STAGGER_MS);
    }
  });
  await Promise.all(workers);
  return out;
}

// One quick retry — adsb.lol answers a burst with 429 but is fine a beat later.
async function fetchAdsb(url: string): Promise<AdsbAircraft[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { timeout: 8000, headers: ADSBL_HEADERS });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data?.ac) ? data.ac : [];
      }
      if (res.status === 429 && attempt === 0) {
        await sleep(1500);
        continue;
      }
      return null;
    } catch {
      if (attempt === 0) {
        await sleep(600);
        continue;
      }
      return null;
    }
  }
  return null;
}

function analyze(ap: AirportRef, nowMs: number): AirportStatus {
  const prefix = `${ap.code}:`;
  const windowMin = Math.round(WINDOW_MS / 60_000);

  // Collect this airport's per-aircraft series inside the analysis window.
  const seriesByHex: Sample[][] = [];
  for (const [key, samples] of HISTORY) {
    if (!key.startsWith(prefix)) continue;
    const win = samples.filter((s) => nowMs - s.t <= WINDOW_MS);
    if (win.length) seriesByHex.push(win);
  }

  let arrivals = 0;
  let departures = 0;
  let goArounds = 0;
  let holding = 0;
  let onGround = 0;
  let inbound = 0;

  for (const series of seriesByHex) {
    const latest = series[series.length - 1];

    // Landed: was airborne near the field, later on the ground / very low on it.
    const airborneNear = series.some((s) => !s.ground && s.alt > 2500 && s.dist < 40);
    const downAtField = series.some((s) => (s.ground || s.alt < 600) && s.dist < 8);
    const idxDown = series.findIndex((s) => (s.ground || s.alt < 600) && s.dist < 8);
    if (airborneNear && downAtField) arrivals++;

    // Departed: started on / just above the runway, later climbing out fast.
    const onRunway = series.findIndex((s) => (s.ground || s.alt < 1200) && s.dist < 8);
    const climbedOut = series.some(
      (s, i) => onRunway >= 0 && i > onRunway && s.alt > 5000 && s.gs > 150 && s.dist > 6,
    );
    if (onRunway >= 0 && climbedOut) departures++;

    // Go-around: dipped to the threshold, climbed away, never landed.
    const dipIdx = series.findIndex((s) => !s.ground && s.alt < 2500 && s.dist < 8);
    const climbedAfterDip = series.some(
      (s, i) => dipIdx >= 0 && i > dipIdx && s.alt > 4500 && s.dist < 25,
    );
    const landedEventually = idxDown >= 0 && idxDown > dipIdx;
    if (dipIdx >= 0 && climbedAfterDip && !landedEventually) goArounds++;

    // Live-state checks on the most recent sample.
    if (latest.ground && latest.dist < 6) onGround++;

    if (!latest.ground && latest.dist >= 8 && latest.dist < 60 && latest.alt < 20000) {
      const first = series[0];
      if (first.dist - latest.dist > 5) inbound++;
    }

    // Holding: sitting in a stack — in the hold altitude band, close-ish, and
    // over >=6 min it has made no real progress toward the runway.
    const spanMin = (latest.t - series[0].t) / 60_000;
    if (
      !latest.ground &&
      latest.dist >= 8 &&
      latest.dist <= 55 &&
      latest.alt >= 6000 &&
      latest.alt <= 26000 &&
      latest.gs < 320 &&
      spanMin >= 6
    ) {
      const minDist = Math.min(...series.map((s) => s.dist));
      if (latest.dist - minDist < 6) holding++;
    }
  }

  const seenCount = seriesByHex.length;
  const firstSeen = FIRST_SEEN.get(ap.code) ?? nowMs;
  const warming = nowMs - firstSeen < WARMUP_MS;
  const throughput = arrivals + departures;

  let status: Status;
  let severity: Severity;
  let note: string;

  if (warming) {
    status = 'WARMUP';
    severity = 'none';
    note = `building baseline — ${Math.max(0, Math.round((WARMUP_MS - (nowMs - firstSeen)) / 60_000))} min to go`;
  } else if (seenCount === 0) {
    status = 'DORMANT';
    severity = 'info';
    note = 'no ADS-B traffic in range';
  } else if ((throughput === 0 && inbound === 0 && onGround >= 4) || (arrivals === 0 && departures === 0 && onGround >= 8)) {
    status = 'CLOSED';
    severity = 'critical';
    note = `no arrivals or departures in ${windowMin} min · ${onGround} aircraft on the ground`;
  } else if (departures === 0 && arrivals >= 1 && onGround >= 6) {
    status = 'GROUND_STOP';
    severity = 'warn';
    note = `${arrivals} landed, 0 departed in ${windowMin} min · possible ground stop`;
  } else if (holding >= 3 || goArounds >= 2) {
    status = 'DISRUPTED';
    severity = 'warn';
    note = `${holding} holding · ${goArounds} go-around${goArounds === 1 ? '' : 's'}`;
  } else if (holding >= 1 || goArounds >= 1) {
    status = 'BUSY';
    severity = 'info';
    note = `${holding} holding · ${goArounds} go-around${goArounds === 1 ? '' : 's'}`;
  } else {
    status = 'NORMAL';
    severity = 'none';
    note = `${arrivals} arr / ${departures} dep in ${windowMin} min`;
  }

  return {
    code: ap.code,
    name: ap.name,
    lat: ap.lat,
    lon: ap.lon,
    status,
    severity,
    arrivals,
    departures,
    holding,
    goArounds,
    onGround,
    inbound,
    windowMin,
    note,
    stale: false,
    polledAgoSec: LAST_POLLED.has(ap.code) ? Math.round((nowMs - LAST_POLLED.get(ap.code)!) / 1000) : null,
    updated: new Date(nowMs).toISOString(),
  };
}

function pruneStale(nowMs: number) {
  for (const [key, samples] of HISTORY) {
    const last = samples[samples.length - 1];
    if (!last || nowMs - last.t > HISTORY_TTL_MS) HISTORY.delete(key);
  }
}

export async function GET(req: Request) {
  const { server } = getConflictFromRequest(req);
  const airports = server.disruptionAirports ?? [];
  const nowMs = Date.now();

  if (airports.length === 0) {
    return NextResponse.json(
      { airports: [], windowMin: Math.round(WINDOW_MS / 60_000), disruptedCount: 0, source: 'adsb.lol', updated: new Date(nowMs).toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
    );
  }

  pruneStale(nowMs);

  // Refresh a rotating slice this cycle; the rest keep their history-derived
  // status. Slice advances once per minute, roughly in step with the 60 s cache.
  const sorted = [...airports].sort((a, b) => (a.code < b.code ? -1 : 1));
  const groups = Math.ceil(sorted.length / GROUP_SIZE);
  const gi = Math.floor(nowMs / 60_000) % groups;
  const group = sorted.slice(gi * GROUP_SIZE, gi * GROUP_SIZE + GROUP_SIZE);

  const staleCodes = new Set<string>();

  await mapPool(group, POOL, async (ap) => {
    const ac = await fetchAdsb(
      `https://api.adsb.lol/v2/lat/${ap.lat}/lon/${ap.lon}/dist/${FEED_RADIUS_NM}`,
    );
    if (ac === null) {
      staleCodes.add(ap.code);
      return;
    }
    FIRST_SEEN.set(ap.code, Math.min(FIRST_SEEN.get(ap.code) ?? nowMs, nowMs));
    LAST_POLLED.set(ap.code, nowMs);

    for (const a of ac) {
      if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue;
      const hex = (a.hex || '').trim().replace('~', '');
      if (!hex) continue;

      const sample: Sample = {
        t: nowMs,
        alt: toFeet(a.alt_baro),
        gs: Math.round(a.gs || 0),
        dist: haversineNm(ap.lat, ap.lon, a.lat, a.lon),
        ground: isGround(a.alt_baro),
      };

      const key = `${ap.code}:${hex}`;
      const hist = HISTORY.get(key) ?? [];
      const prev = hist[hist.length - 1];
      if (!prev || nowMs - prev.t >= MIN_SAMPLE_GAP_MS) {
        hist.push(sample);
        const cutoff = nowMs - HISTORY_TTL_MS;
        HISTORY.set(key, hist.filter((s) => s.t >= cutoff));
      }
    }
  });

  const statuses = airports.map((ap) => {
    const s = analyze(ap, nowMs);
    if (staleCodes.has(ap.code)) {
      s.stale = true;
      if (s.status === 'WARMUP' || s.status === 'NORMAL' || s.status === 'DORMANT') {
        s.note = 'feed unavailable this cycle';
      }
    }
    return s;
  });

  statuses.sort(
    (x, y) => SEVERITY_RANK[y.severity] - SEVERITY_RANK[x.severity] || (x.code < y.code ? -1 : 1),
  );

  const disruptedCount = statuses.filter((s) => s.severity === 'warn' || s.severity === 'critical').length;

  return NextResponse.json(
    {
      airports: statuses,
      windowMin: Math.round(WINDOW_MS / 60_000),
      disruptedCount,
      source: 'adsb.lol',
      updated: new Date(nowMs).toISOString(),
    },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}
