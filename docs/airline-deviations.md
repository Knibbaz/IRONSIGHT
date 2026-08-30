# Airline deviation monitor

Backend-only watcher that flags abnormal behaviour by selected commercial
airlines — an early escalation signal (carriers reroute/turn back before
airspace closures are announced).

## How it works

- **`src/lib/watchedAirlines.ts`** — airline registry + scope resolution.
  Scope comes from the `WATCHED_AIRLINES` env var (comma-separated ICAO codes
  or names, e.g. `UAE,ETD,QTR`). Unset → `Emirates` only. Set it in
  `docker-compose.yml` under `environment:` (no `.env` file needed); the value
  is read at process start, so restart the container after changing it.
- **`src/app/api/airline-deviations/route.ts`** — pulls live ADS-B from
  adsb.lol for the active theater, keeps a short in-memory track history per
  aircraft, and flags:
  - emergency squawk 7500 / 7600 / 7700 (fires on a single poll)
  - course reversal / turn-back
  - holding pattern / circling
  - rapid descent while still at altitude
- History is module-level = per server instance, reset on restart/redeploy.

## Remaining work

- [ ] **Nothing polls the endpoint yet.** Turn-back / holding / descent
      detection needs the route hit every ~30–60 s to accumulate history.
      Add a scheduler (cron / loop) or a polling client. Emergency squawks
      work without history.
- [ ] **No frontend.** Optionally add a dashboard panel + map layer (trail +
      severity colour), mirroring the drone layer.
- [ ] **Fix `/api/flights`** — currently returns nothing: adsb.lol now sends
      403 without a `User-Agent` header. Same one-line fix applied in the new
      route; not yet applied there.
- [ ] **Repeated reports.** Each poll re-emits the same ongoing deviation.
      A consumer needs to dedupe by `hex` + reason, or the route should carry
      a stable id / "first flagged at".
- [ ] **No airspace-avoidance detection.** Heuristics miss a flight that
      calmly reroutes around a country without a sharp turn. Would need an
      expected great-circle route (origin/destination from adsb.lol's route
      API or a schedules source) vs actual track.
- [ ] **Thresholds tuned by eye** (`WINDOW_MS`, straightness ratios, descent
      ft/min). Validate against real diversion events and adjust.
- [ ] **Registry labels.** Unknown ICAO codes passed via `WATCHED_AIRLINES`
      display the raw code as the name — add a row to `REGISTRY` for a proper
      label.
- [ ] **Persistence.** In-memory history is fine for the single container;
      revisit if the deployment ever goes multi-instance.
