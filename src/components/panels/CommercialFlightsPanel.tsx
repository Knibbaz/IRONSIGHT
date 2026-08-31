'use client';

import { useState } from 'react';
import { useConflictFeed } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

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
}

interface TrackedFlight {
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
  deviating: boolean;
  severity?: 'critical' | 'high' | 'medium';
  reasons: string[];
  trail: [number, number][];
  firstSeen: string;
}

interface DeviationData {
  airlines: string[];
  trackedFlights: number;
  deviationCount: number;
  deviations: Deviation[];
  tracked: TrackedFlight[];
  source: string;
  updated: string;
}

type HubStatus = 'WARMUP' | 'DORMANT' | 'NORMAL' | 'BUSY' | 'DISRUPTED' | 'GROUND_STOP' | 'CLOSED';

interface AirportStatus {
  code: string;
  name: string;
  lat: number;
  lon: number;
  status: HubStatus;
  severity: 'none' | 'info' | 'warn' | 'critical';
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

interface AirportStatusData {
  airports: AirportStatus[];
  windowMin: number;
  disruptedCount: number;
  source: string;
  updated: string;
}

const SEVERITY_COLORS = {
  critical: 'var(--red)',
  high: 'var(--amber)',
  medium: 'var(--cyan)',
};

const SEVERITY_BG = {
  critical: 'rgba(255,51,102,0.15)',
  high: 'rgba(255,170,0,0.15)',
  medium: 'rgba(0,212,255,0.15)',
};

const HUB_COLORS: Record<HubStatus, string> = {
  CLOSED: 'var(--red)',
  GROUND_STOP: 'var(--amber)',
  DISRUPTED: 'var(--amber)',
  BUSY: 'var(--cyan)',
  NORMAL: 'var(--green)',
  DORMANT: 'var(--text-secondary)',
  WARMUP: 'var(--text-secondary)',
};

const HUB_BG: Record<HubStatus, string> = {
  CLOSED: 'rgba(255,51,102,0.15)',
  GROUND_STOP: 'rgba(255,170,0,0.15)',
  DISRUPTED: 'rgba(255,170,0,0.15)',
  BUSY: 'rgba(0,212,255,0.15)',
  NORMAL: 'rgba(0,255,136,0.12)',
  DORMANT: 'rgba(148,163,184,0.12)',
  WARMUP: 'rgba(148,163,184,0.12)',
};

function focusOnMapTarget(hex: string, lat: number, lon: number, trail?: [number, number][]) {
  window.dispatchEvent(new CustomEvent('map-focus', {
    detail: { id: hex, lat, lon, type: 'aircraft', trail },
  }));
}

export default function CommercialFlightsPanel() {
  const t = useT();
  const [view, setView] = useState<'hubs' | 'inflight'>('hubs');
  const [showAll, setShowAll] = useState(false);

  const { data: hubData, loading: hubLoading } = useConflictFeed<AirportStatusData>('/api/airport-status', 180000);
  const { data, loading } = useConflictFeed<DeviationData>('/api/airline-deviations', 180000);

  const trackedFlights = data?.tracked || [];
  const deviations = data?.deviations || [];
  const airports = hubData?.airports || [];

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <span
          className="status-dot"
          style={{ background: view === 'hubs' && (hubData?.disruptedCount || 0) > 0 ? 'var(--amber)' : 'var(--green)' }}
        />
        {t('flights.commercial')}
        <button
          onClick={() => setView((v) => (v === 'hubs' ? 'inflight' : 'hubs'))}
          className="text-[9px] tracking-[1px] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--cyan)] hover:border-[var(--cyan)] transition-colors shrink-0"
          title={t('flights.viewTitle')}
        >
          {view === 'hubs' ? t('flights.viewInflight') : t('flights.viewHubs')}
        </button>
        {view === 'inflight' && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-[9px] tracking-[1px] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--cyan)] hover:border-[var(--cyan)] transition-colors shrink-0"
            title={t('flights.trackedTitle')}
          >
            {showAll ? t('flights.showDeviations') : t('flights.showAllTracked')}
          </button>
        )}
        <span className="ml-auto text-[9px] text-[var(--text-secondary)] font-normal normal-case tracking-normal">
          {view === 'hubs'
            ? t('flights.hubStats', { disrupted: hubData?.disruptedCount || 0, total: airports.length })
            : t('flights.commercialStats', {
                tracked: data?.trackedFlights || 0,
                deviating: data?.deviationCount || 0,
              })}
        </span>
      </div>

      {view === 'hubs' ? (
        <HubsView airports={airports} loading={hubLoading} windowMin={hubData?.windowMin || 35} t={t} />
      ) : (
        <InflightView
          data={data}
          loading={loading}
          showAll={showAll}
          deviations={deviations}
          trackedFlights={trackedFlights}
          t={t}
        />
      )}
    </div>
  );
}

function HubsView({
  airports,
  loading,
  windowMin,
  t,
}: {
  airports: AirportStatus[];
  loading: boolean;
  windowMin: number;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--border-color)] bg-[var(--bg-panel-header)]">
        <span className="text-[8px] text-[var(--text-secondary)]">{t('flights.hubWindow', { min: windowMin })}</span>
        <span className="text-[8px] text-[var(--text-secondary)]">adsb.lol</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && airports.length === 0 ? (
          <div className="space-y-2 p-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="loading-shimmer h-9 rounded" />
            ))}
          </div>
        ) : airports.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-secondary)] text-xs">{t('flights.hubEmpty')}</div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {airports.map((a) => (
              <div
                key={a.code}
                className="data-row cursor-pointer hover:!bg-[rgba(0,255,136,0.08)]"
                onClick={() => focusOnMapTarget(`hub-${a.code}`, a.lat, a.lon)}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold text-[var(--text-primary)]">{a.code}</span>
                    <span className="text-[8px] text-[var(--text-secondary)]">{a.name}</span>
                    {a.stale ? (
                      <span className="text-[7px] text-[var(--text-secondary)] italic">{t('flights.hubStale')}</span>
                    ) : a.polledAgoSec != null && a.polledAgoSec > 100 ? (
                      <span className="text-[7px] text-[var(--text-secondary)]">{Math.round(a.polledAgoSec / 60)}m ago</span>
                    ) : null}
                  </div>
                  <span
                    className="text-[7px] px-1 py-0.5 rounded font-bold uppercase tracking-wide"
                    style={{ color: HUB_COLORS[a.status], backgroundColor: HUB_BG[a.status] }}
                  >
                    {t(`flights.status.${a.status}` as TranslationKey)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[8px] text-[var(--text-secondary)] gap-2">
                  <span className="leading-tight">{a.note}</span>
                  <span className="font-mono shrink-0 text-[var(--text-secondary)]">
                    {t('flights.hubRowStats', {
                      arr: a.arrivals,
                      dep: a.departures,
                      hold: a.holding,
                      ga: a.goArounds,
                      gnd: a.onGround,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function InflightView({
  data,
  loading,
  showAll,
  deviations,
  trackedFlights,
  t,
}: {
  data: DeviationData | null | undefined;
  loading: boolean;
  showAll: boolean;
  deviations: Deviation[];
  trackedFlights: TrackedFlight[];
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  return (
    <>
      {data && data.deviationCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-panel-header)]">
          <span className="text-[8px] text-[var(--red)] font-bold">
            {data.deviationCount} {data.deviationCount === 1 ? t('flights.deviation') : t('flights.deviations')}
          </span>
          <span className="text-[8px] text-[var(--text-secondary)]">
            {t('flights.commercialOfTotal', {
              normal: data.trackedFlights - data.deviationCount,
              total: data.trackedFlights,
            })}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="loading-shimmer h-8 rounded" />
            ))}
          </div>
        ) : !data || (deviations.length === 0 && trackedFlights.length === 0) ? (
          <div className="p-4 text-center text-[var(--text-secondary)] text-xs">
            {t('flights.noDeviations')}<br />
            <span className="text-[8px]">{t('flights.commercialHint')}</span>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {showAll ? (
              trackedFlights.map((d, i) => (
                <div
                  key={`${d.hex}-${i}`}
                  className="data-row cursor-pointer hover:!bg-[rgba(0,255,136,0.1)]"
                  onClick={() => focusOnMapTarget(d.hex, d.lat, d.lon, d.trail)}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold" style={{ color: d.deviating ? SEVERITY_COLORS[d.severity!] : 'var(--cyan)' }}>
                        {d.callsign}
                      </span>
                      {d.deviating && (
                        <span
                          className="text-[7px] px-1 py-0.5 rounded font-bold uppercase"
                          style={{ color: SEVERITY_COLORS[d.severity!], backgroundColor: SEVERITY_BG[d.severity!] }}
                        >
                          {d.severity}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {d.registration && (
                        <span className="text-[8px] text-[var(--text-secondary)] font-mono">{d.registration}</span>
                      )}
                      <a
                        href={`https://www.flightradar24.com/${encodeURIComponent(d.callsign.trim() || d.hex)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-[var(--text-secondary)] hover:text-[var(--cyan)] px-0.5"
                        title={`Open ${d.callsign.trim() || d.hex} on Flightradar24`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        ↗
                      </a>
                      <span className="text-[8px] text-[var(--text-secondary)]">📍</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[8px] text-[var(--text-secondary)]">
                    <span>{d.airline} • {d.aircraftType}</span>
                    <span>{d.altitude.toLocaleString()}ft {d.speed}kts {d.heading}°</span>
                  </div>
                  {d.deviating && d.reasons.length > 0 && (
                    <div className="mt-0.5 text-[8px] text-[var(--red)] leading-tight">
                      {d.reasons.map((r, ri) => (
                        <div key={ri}>• {r}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              deviations.map((d, i) => (
                <div
                  key={`${d.hex}-${i}`}
                  className="data-row cursor-pointer hover:!bg-[rgba(0,255,136,0.1)]"
                  onClick={() => focusOnMapTarget(d.hex, d.lat, d.lon, d.trail)}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold" style={{ color: SEVERITY_COLORS[d.severity] }}>
                        {d.callsign}
                      </span>
                      <span
                        className="text-[7px] px-1 py-0.5 rounded font-bold uppercase"
                        style={{ color: SEVERITY_COLORS[d.severity], backgroundColor: SEVERITY_BG[d.severity] }}
                      >
                        {d.severity}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {d.registration && (
                        <span className="text-[8px] text-[var(--text-secondary)] font-mono">{d.registration}</span>
                      )}
                      <a
                        href={`https://www.flightradar24.com/${encodeURIComponent(d.callsign.trim() || d.hex)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-[var(--text-secondary)] hover:text-[var(--cyan)] px-0.5"
                        title={`Open ${d.callsign.trim() || d.hex} on Flightradar24`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        ↗
                      </a>
                      <span className="text-[8px] text-[var(--text-secondary)]">📍</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[8px] text-[var(--text-secondary)]">
                    <span>{d.airline} • {d.aircraftType}</span>
                    <span>{d.altitude.toLocaleString()}ft {d.speed}kts {d.heading}°</span>
                  </div>
                  {d.reasons.length > 0 && (
                    <div className="mt-0.5 text-[8px] text-[var(--text-secondary)] leading-tight">
                      {d.reasons.map((r, ri) => (
                        <div key={ri}>• {r}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
