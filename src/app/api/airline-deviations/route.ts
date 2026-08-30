import { NextResponse } from 'next/server';

import { fetchWithTimeout } from '@/lib/fetcher';
import { getConflictFromRequest } from '@/lib/conflicts';
import { matchAirline, WATCHED_AIRLINES } from '@/lib/watchedAirlines';

export const dynamic = 'force-dynamic';

// Commercial-airline deviation monitor.
//
// Pulls live ADS-B from adsb.lol for the theater, keeps a short in-memory
// track history per aircraft, and flags flights that are behaving abnormally:
// turn-backs / diversions, holding patterns, rapid descents, or squawking an
// emergency code. Airline scope is the list in src/lib/watchedAirlines.ts
// (Emirates today; add Etihad / Qatar by uncommenting a row there).
//
// State is module-level and therefore per server instance — fine for the
// single-container local deployment. Dev-mode hot reload will reset it.

interface AdsbAircraft {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  gs?: number;
  track?: number;
  squawk?: string;
}

interface Sample {
  t: number;   // epoch ms
  lat: number;
  lon: number;
  alt: number; // feet
  trk: number; // deg
  gs: number;  // knots
  sq: string;
}

interface Deviation {
  airline: string;
  callsign: string;
  hex: string;
  registration: string;
  aircraftType: string;
  lat: number;
  lon: number;
  altitude: number;
  heading: number;
  speed: number;
  severity: 'critical' | 'high' | 'medium';
  reasons: string[];
  trail: [number, number][];
  firstSeen: string;
  updated: string;
}

const HISTORY = new Map<string, Sample[]>();
const MIN_SAMPLE_GAP_MS = 20_000;   // don't record denser than this per aircraft
const HISTORY_TTL_MS = 60 * 60_000; // drop aircraft not seen for an hour
const WINDOW_MS = 25 * 60_000;      // analysis window
const MAX_SAMPLES = 240;

const EMERGENCY_SQUAWKS = new Set(['7500', '7600', '7700']);

function toFeet(v: number | string | undefined): number {
  if (typeof v === 'number') return v;
  if (v === 'ground') return 0;
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Smallest absolute difference between two compass headings, 0..180.
function headingDelta(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

function avgHeading(samples: Sample[]): number {
  let x = 0;
  let y = 0;
  for (const s of samples) {
    x += Math.cos((s.trk * Math.PI) / 180);
    y += Math.sin((s.trk * Math.PI) / 180);
  }
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function analyze(history: Sample[]): { severity: Deviation['severity']; reasons: string[] } | null {
  if (history.length === 0) return null;
  const now = history[history.length - 1].t;
  const win = history.filter((s) => now - s.t <= WINDOW_MS);
  const latest = win[win.length - 1] ?? history[history.length - 1];

  const reasons: string[] = [];
  let severity: Deviation['severity'] | null = null;
  const bump = (s: Deviation['severity']) => {
    const rank = { medium: 1, high: 2, critical: 3 } as const;
    if (!severity || rank[s] > rank[severity]) severity = s;
  };

  // 1. Emergency squawk — always report, regardless of history depth.
  if (EMERGENCY_SQUAWKS.has(latest.sq)) {
    const label: Record<string, string> = {
      '7500': 'squawk 7500 (unlawful interference)',
      '7600': 'squawk 7600 (radio failure)',
      '7700': 'squawk 7700 (general emergency)',
    };
    reasons.push(label[latest.sq]);
    bump('critical');
  }

  const airborne = win.filter((s) => s.alt > 8000);
  if (airborne.length >= 3) {
    const first = airborne[0];
    const last = airborne[airborne.length - 1];
    const spanMin = (last.t - first.t) / 60_000;

    let pathKm = 0;
    for (let i = 1; i < airborne.length; i++) {
      pathKm += haversineKm(airborne[i - 1].lat, airborne[i - 1].lon, airborne[i].lat, airborne[i].lon);
    }
    const netKm = haversineKm(first.lat, first.lon, last.lat, last.lon);
    const straightness = pathKm > 0 ? netKm / pathKm : 1;
    const hdgChange = headingDelta(
      avgHeading(airborne.slice(0, 3)),
      avgHeading(airborne.slice(-3)),
    );

    // 2. Turn-back / diversion: substantial track flown, but ending up near
    //    where it started while heading has largely reversed.
    if (spanMin >= 6 && pathKm > 40 && straightness < 0.35 && hdgChange > 120) {
      reasons.push(`course reversal — heading swung ~${Math.round(hdgChange)}deg over ${Math.round(spanMin)} min`);
      bump('high');
    // 3. Holding / circling: looping in a small area without net progress.
    } else if (spanMin >= 6 && pathKm > 25 && netKm < 25 && straightness < 0.5) {
      reasons.push(`holding pattern — ${Math.round(pathKm)} km flown, ${Math.round(netKm)} km net over ${Math.round(spanMin)} min`);
      bump('medium');
    }

    // 4. Rapid descent while still at altitude (possible diversion to alternate).
    const dropFt = first.alt - last.alt;
    const dropMin = (last.t - first.t) / 60_000;
    if (dropMin > 0 && dropMin <= 12 && dropFt > 12000 && last.alt > 6000) {
      reasons.push(`rapid descent — ${Math.round(dropFt / 100) * 100} ft in ${Math.round(dropMin)} min`);
      bump('medium');
    }
  }

  if (!severity || reasons.length === 0) return null;
  return { severity, reasons };
}

function pruneStale(nowMs: number) {
  for (const [hex, samples] of HISTORY) {
    const last = samples[samples.length - 1];
    if (!last || nowMs - last.t > HISTORY_TTL_MS) HISTORY.delete(hex);
  }
}

export async function GET(req: Request) {
  const { server } = getConflictFromRequest(req);
  const { flightsCenter: c } = server;
  const nowMs = Date.now();

  try {
    const res = await fetchWithTimeout(
      `https://api.adsb.lol/v2/lat/${c.lat}/lon/${c.lon}/dist/${c.dist}`,
      { timeout: 8000, headers: { 'User-Agent': 'IronSight/1.0', Accept: 'application/json' } },
    );
    const data = res.ok ? await res.json() : { ac: [] };
    const ac: AdsbAircraft[] = Array.isArray(data?.ac) ? data.ac : [];

    pruneStale(nowMs);

    const tracked: Deviation[] = [];
    const seenHex = new Set<string>();

    for (const a of ac) {
      const airline = matchAirline(a.flight || '');
      if (!airline) continue;
      if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue;

      const hex = (a.hex || '').trim().replace('~', '');
      if (!hex) continue;
      seenHex.add(hex);

      const sample: Sample = {
        t: nowMs,
        lat: a.lat,
        lon: a.lon,
        alt: toFeet(a.alt_baro),
        trk: typeof a.track === 'number' ? a.track : 0,
        gs: Math.round(a.gs || 0),
        sq: (a.squawk || '').trim(),
      };

      const hist = HISTORY.get(hex) ?? [];
      const prev = hist[hist.length - 1];
      if (!prev || nowMs - prev.t >= MIN_SAMPLE_GAP_MS) {
        hist.push(sample);
        while (hist.length > MAX_SAMPLES) hist.shift();
        const cutoff = nowMs - HISTORY_TTL_MS;
        HISTORY.set(hex, hist.filter((s) => s.t >= cutoff));
      }

      const verdict = analyze(HISTORY.get(hex) ?? [sample]);
      if (!verdict) continue;

      const series = HISTORY.get(hex) ?? [sample];
      tracked.push({
        airline: airline.name,
        callsign: (a.flight || '').trim(),
        hex,
        registration: a.r || '',
        aircraftType: a.t || '',
        lat: a.lat,
        lon: a.lon,
        altitude: sample.alt,
        heading: Math.round(sample.trk),
        speed: sample.gs,
        severity: verdict.severity,
        reasons: verdict.reasons,
        trail: series.slice(-40).map((s) => [s.lat, s.lon] as [number, number]),
        firstSeen: new Date(series[0].t).toISOString(),
        updated: new Date(nowMs).toISOString(),
      });
    }

    const rank = { critical: 3, high: 2, medium: 1 };
    tracked.sort((x, y) => rank[y.severity] - rank[x.severity]);

    return NextResponse.json(
      {
        airlines: WATCHED_AIRLINES.map((a) => a.name),
        trackedFlights: seenHex.size,
        deviationCount: tracked.length,
        deviations: tracked,
        source: 'adsb.lol',
        updated: new Date(nowMs).toISOString(),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=15' } },
    );
  } catch (err) {
    console.error('Airline deviation fetch error:', err);
    return NextResponse.json(
      {
        airlines: WATCHED_AIRLINES.map((a) => a.name),
        trackedFlights: 0,
        deviationCount: 0,
        deviations: [],
        source: 'adsb.lol',
        error: 'fetch failed',
        updated: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
