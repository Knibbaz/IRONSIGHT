'use client';

import { useConflictFeed } from '@/lib/hooks';
import { useT } from '@/lib/i18n';

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
  firstSeen: string;
}

interface DeviationData {
  airlines: string[];
  trackedFlights: number;
  deviationCount: number;
  deviations: Deviation[];
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

function focusOnMapTarget(lat: number, lon: number) {
  window.dispatchEvent(new CustomEvent('map-focus', {
    detail: { id: '', lat, lon, type: 'aircraft' },
  }));
}

export default function CommercialFlightsPanel() {
  const { data, loading } = useConflictFeed<DeviationData>('/api/airline-deviations', 180000);
  const t = useT();

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <span className="status-dot" style={{ background: 'var(--green)' }} />
        {t('flights.commercial')}
        <span className="ml-auto text-[9px] text-[var(--text-secondary)] font-normal normal-case tracking-normal">
          {t('flights.commercialStats', {
            tracked: data?.trackedFlights || 0,
            deviating: data?.deviationCount || 0,
          })}
        </span>
      </div>

      {/* Deviation summary bar */}
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
        ) : !data || data.deviations.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-secondary)] text-xs">
            {t('flights.noDeviations')}<br />
            <span className="text-[8px]">{t('flights.commercialHint')}</span>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {data.deviations.map((d, i) => (
              <div
                key={d.hex || i}
                className="data-row cursor-pointer hover:!bg-[rgba(0,255,136,0.1)]"
                onClick={() => focusOnMapTarget(d.lat, d.lon)}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}