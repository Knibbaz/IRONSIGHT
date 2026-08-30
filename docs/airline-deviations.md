# Airline deviation monitor

Backend-only watcher that flags abnormal behaviour by selected commercial
airlines — an early escalation signal (carriers reroute / turn back before
airspace closures are announced).

## Status

Working backend, no frontend, nothing polls it yet. Committed on `main`:

- `99b5804` — this feature (`watchedAirlines.ts`, `api/airline-deviations`,
  `docker-compose.yml`, this doc)
- `d073daf` — unrelated: verify fresh article dates against page metadata
  (`articleDate.ts` + news/strikes/conflicts/regional-alerts routes). Not part
  of this feature, just committed in the same session.

Neither commit is pushed yet — `git push` from whichever PC picks this up.

## How it works

- **`src/lib/watchedAirlines.ts`** — airline registry + scope resolution.
  Scope comes from the `WATCHED_AIRLINES` env var (comma-separated ICAO codes
  or names, e.g. `UAE,ETD,QTR`). Unset → `Emirates` only. Registry currently
  knows Emirates (`UAE`), Etihad (`ETD`), Qatar Airways (`QTR`); unknown
  2–3 letter codes are accepted with the raw code as the display name.
- **`src/app/api/airline-deviations/route.ts`** — pulls live ADS-B from
  adsb.lol for the active theater (same bbox as `/api/flights`), keeps a short
  in-memory track history per aircraft (`HISTORY` map, 20 s min sample gap,
  1 h TTL), and flags:
  - emergency squawk 7500 / 7600 / 7700 — fires on a single poll
  - course reversal / turn-back — long path flown, ends near start, heading
    swung > 120°
  - holding pattern / circling — loops in a small area, no net progress
  - rapid descent — > 12 000 ft in ≤ 12 min while still above 6 000 ft
- History is module-level = per server instance, reset on restart / redeploy /
  dev hot-reload.

## Configure the airline list

`docker-compose.yml` → `services.ironsight.environment`:

```yaml
- WATCHED_AIRLINES=UAE,ETD,QTR
```

No `.env` file. Read at process start, so `docker compose up -d` to apply.

## Run & test locally

```bash
npm run dev
curl -s localhost:3000/api/airline-deviations | python3 -m json.tool
# override the list for one run:
WATCHED_AIRLINES=UAE,QTR npm run dev
```

Expected shape: `{ airlines, trackedFlights, deviationCount, deviations[], ... }`.
`deviationCount` will be 0 until either an emergency squawk appears or the
endpoint has been polled repeatedly for ~6+ min so history builds up.

## Remaining work — priority order

1. **Poll the endpoint.** Turn-back / holding / descent detection needs the
   route hit every ~30–60 s to accumulate history. Add a scheduler (cron /
   `/loop`) or a polling client. Emergency squawks work without it. Nothing
   calls the route today, so in practice it only catches squawks right now.
2. **Fix `/api/flights`.** Currently returns nothing — adsb.lol started
   sending `403` without a `User-Agent` header. One-line fix: add
   `'User-Agent': 'IronSight/1.0'` to the two `fetchWithTimeout` calls in
   `src/app/api/flights/route.ts` (already done in the new route).
3. **Dedupe repeated reports.** Every poll re-emits the same ongoing
   deviation. Either the route carries a stable id + "first flagged at", or
   the consumer dedupes by `hex` + reason.
4. **Frontend (optional).** Dashboard panel + map layer (trail polyline,
   colour by `severity`), mirroring the drone layer in `src/components`.
5. **Airspace-avoidance detection.** Heuristics miss a flight that calmly
   reroutes around a country without a sharp turn. Needs an expected
   great-circle route (origin/destination from adsb.lol's route API or a
   schedules source) compared against the actual track.
6. **Tune thresholds.** `WINDOW_MS`, straightness ratios, descent ft/min in
   `route.ts` were picked by eye — validate against a real diversion event
   (e.g. replay a day when Gulf carriers avoided Iranian airspace) and adjust.
7. **Registry labels.** Add rows to `REGISTRY` in `watchedAirlines.ts` for any
   airline you pass via `WATCHED_AIRLINES` so it shows a name, not the code.
8. **Persistence.** In-memory history is fine for the single container;
   revisit only if the deployment goes multi-instance.
