// Watch list for commercial-airline deviation monitoring.
//
// The airline-deviations API route (src/app/api/airline-deviations/route.ts)
// pulls live ADS-B from adsb.lol and only inspects flights whose callsign
// matches one of the ICAO prefixes below.
//
// Scope is controlled by the WATCHED_AIRLINES env var (server-side only — set
// it in docker-compose's `environment:` block, no .env file needed):
//
//   environment:
//     - WATCHED_AIRLINES=UAE,ETD,QTR
//
// Value is a comma-separated list of ICAO airline codes or names, matched
// case-insensitively against the registry below. Unknown 3-letter tokens are
// still accepted (callsign match only, no registration enrichment).
// When the var is unset it falls back to DEFAULT_AIRLINES.

export interface WatchedAirline {
  name: string;
  // ICAO airline designator — the leading letters of the ADS-B callsign
  // (e.g. Emirates flight "UAE231" -> "UAE").
  icao: string;
  // Aircraft-registration prefixes for this operator's fleet, used only to
  // enrich output. Emirates & Etihad both fly A6-, Qatar Airways flies A7-.
  regPrefixes: string[];
}

// Known operators — extend as needed.
const REGISTRY: WatchedAirline[] = [
  { name: 'Emirates', icao: 'UAE', regPrefixes: ['A6-'] },
  { name: 'Etihad Airways', icao: 'ETD', regPrefixes: ['A6-'] },
  { name: 'Qatar Airways', icao: 'QTR', regPrefixes: ['A7-'] },
];

const DEFAULT_AIRLINES = ['Emirates'];

function resolve(token: string): WatchedAirline | null {
  const t = token.trim().toUpperCase();
  if (!t) return null;
  const hit = REGISTRY.find((a) => a.icao === t || a.name.toUpperCase() === t);
  if (hit) return hit;
  // Bare ICAO-style code we don't know — accept it, callsign match only.
  if (/^[A-Z]{2,3}$/.test(t)) return { name: t, icao: t, regPrefixes: [] };
  return null;
}

function build(): WatchedAirline[] {
  const raw = process.env.WATCHED_AIRLINES?.trim();
  const tokens = (raw ? raw.split(',') : DEFAULT_AIRLINES)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: WatchedAirline[] = [];
  const seen = new Set<string>();
  for (const tok of tokens) {
    const airline = resolve(tok);
    if (airline && !seen.has(airline.icao)) {
      seen.add(airline.icao);
      out.push(airline);
    }
  }
  return out.length ? out : REGISTRY.filter((a) => DEFAULT_AIRLINES.includes(a.name));
}

export const WATCHED_AIRLINES: WatchedAirline[] = build();

// Resolve a raw ADS-B callsign to a watched airline, or null.
export function matchAirline(callsign: string): WatchedAirline | null {
  const cs = (callsign || '').trim().toUpperCase();
  if (!cs) return null;
  for (const a of WATCHED_AIRLINES) {
    // Require the prefix to be followed by a digit so "UAE" doesn't also
    // swallow unrelated callsigns that merely start with those letters.
    if (cs.startsWith(a.icao) && /\d/.test(cs.charAt(a.icao.length))) return a;
  }
  return null;
}
