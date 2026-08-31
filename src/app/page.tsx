'use client';

import dynamic from 'next/dynamic';
import MetricsBar from '@/components/panels/MetricsBar';
import ThreatClock from '@/components/panels/ThreatClock';
import NewsFeed from '@/components/panels/NewsFeed';
import OilPanel from '@/components/panels/OilPanel';
import MarketsPanel from '@/components/panels/MarketsPanel';
import ConflictFeed from '@/components/panels/ConflictFeed';
import TelegramPanel from '@/components/panels/TelegramPanel';
import CommercialFlightsPanel from '@/components/panels/CommercialFlightsPanel';
import FlightsPanel from '@/components/panels/FlightsPanel';
import StrikesPanel from '@/components/panels/StrikesPanel';
import AlertsPanel from '@/components/panels/AlertsPanel';
import SatellitePanel from '@/components/panels/SatellitePanel';
import NavalPanel from '@/components/panels/NavalPanel';
import RegionalAlertsPanel from '@/components/panels/RegionalAlertsPanel';
import CryptoPanel from '@/components/panels/CryptoPanel';
import PolymarketPanel from '@/components/panels/PolymarketPanel';
import ConflictToggle from '@/components/ConflictToggle';
import LanguageToggle from '@/components/LanguageToggle';
import PanelVisibilityMenu from '@/components/PanelVisibilityMenu';
import { useConflict } from '@/lib/conflicts/context';
import { useT } from '@/lib/i18n';
import { useDashboardLayout, useIsMobile, buildMobileLayout, PANEL_LABELS } from '@/lib/layout';
import { useState, useEffect, useMemo } from 'react';

const ConflictMap = dynamic(() => import('@/components/map/ConflictMap'), {
  ssr: false,
  loading: () => <div className="panel h-full loading-shimmer" />,
});

const DashboardGrid = dynamic(() => import('@/components/DashboardGrid'), {
  ssr: false,
  loading: () => <div className="flex-1 loading-shimmer" />,
});

export default function Dashboard() {
  const { key: conflictKey, config } = useConflict();
  const t = useT();
  const { layout, onLayoutChange, mobileOrder, onMobileLayoutChange, reset: resetLayout, hidden, togglePanel } = useDashboardLayout();
  const isMobile = useIsMobile();
  const [editMode, setEditMode] = useState(false);
  const mobileLayout = useMemo(() => buildMobileLayout(mobileOrder), [mobileOrder]);
  const [uptime, setUptime] = useState(0);
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setUptime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)] shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 sm:px-4 py-1.5">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 shrink-0">
              <div className="absolute inset-0 rounded-full border border-[var(--cyan)] opacity-30" />
              <div className="absolute inset-1 rounded-full border border-[var(--cyan)] opacity-20" />
              <div className="absolute inset-2 rounded-full border border-[var(--cyan)] opacity-10" />
              <div
                className="absolute bottom-1/2 left-1/2 -ml-px w-0.5 h-4 bg-[var(--cyan)] origin-bottom radar-sweep"
              />
              <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-[var(--cyan)] rounded-full -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-[3px] text-[var(--cyan)]">IRONSIGHT</h1>
              <p className="hidden sm:block text-[8px] text-[var(--text-secondary)] tracking-[2px]">
                {t('header.tagline')}
              </p>
            </div>
            <span
              className="hidden sm:inline-block text-[8px] text-[var(--text-secondary)] px-1 py-0.5 rounded border border-[var(--border-color)]"
              title="Running build version"
            >
              v{appVersion}
            </span>
          </div>
          <div className="w-full md:w-auto order-last md:order-none overflow-x-auto">
            <MetricsBar />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[9px] text-[var(--text-secondary)]">
            <LanguageToggle />
            <ConflictToggle />
            <PanelVisibilityMenu panelLabels={PANEL_LABELS} hidden={hidden} onToggle={togglePanel} />
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`text-[9px] tracking-[1px] px-2 py-1 rounded border transition-colors ${
                editMode
                  ? 'border-[var(--cyan)] text-[var(--cyan)]'
                  : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--cyan)] hover:border-[var(--cyan)]'
              }`}
              title={t('header.editLayoutTitle')}
            >
              {editMode ? t('header.editLayoutOn') : t('header.editLayout')}
            </button>
            <button
              onClick={resetLayout}
              className="text-[9px] tracking-[1px] px-2 py-1 rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--cyan)] hover:border-[var(--cyan)] transition-colors"
              title={t('header.resetLayoutTitle')}
            >
              {t('header.resetLayout')}
            </button>
            <span className="hidden lg:inline">{t('header.session')} {formatUptime(uptime)}</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
              {t('header.live')}
            </span>
          </div>
        </div>
        <div className="border-t border-[var(--border-color)]">
          <ThreatClock />
        </div>
      </header>

      {/* Main grid — drag panels by their header to reposition, drag the
          bottom-right corner to resize. Layout is saved to this browser only
          (localStorage); "Reset layout" restores the default for everyone. */}
      <DashboardGrid
        isMobile={isMobile}
        editMode={editMode}
        layout={isMobile ? mobileLayout : layout}
        onLayoutChange={isMobile ? onMobileLayoutChange : onLayoutChange}
        hidden={hidden}
        onHidePanel={togglePanel}
        panels={[
          { id: 'news', node: <NewsFeed /> },
          { id: 'map', node: <ConflictMap key={conflictKey} className="h-full" /> },
          { id: 'alerts', node: <AlertsPanel /> },
          { id: 'telegram', node: <TelegramPanel /> },
          { id: 'markets', node: <MarketsPanel /> },
          { id: 'strikes', node: <StrikesPanel /> },
          { id: 'polymarket', node: <PolymarketPanel /> },
          { id: 'conflictFeed', node: <ConflictFeed /> },
          { id: 'flights', node: <FlightsPanel /> },
          { id: 'commercial', node: <CommercialFlightsPanel /> },
          { id: 'regional', node: <RegionalAlertsPanel /> },
          { id: 'naval', node: <NavalPanel /> },
          { id: 'crypto', node: <CryptoPanel /> },
          { id: 'oil', node: <OilPanel /> },
          { id: 'satellite', node: <SatellitePanel /> },
        ]}
      />

      {/* Bottom status bar */}
      <footer className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)] px-2 sm:px-4 py-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-[9px] text-[var(--text-secondary)] shrink-0">
        <span className="truncate">{t('footer.feeds', { alertSystem: config.client.alertSystemName.toUpperCase() })}</span>
        <div className="hidden md:flex items-center gap-4">
          <span>{t('footer.refreshRates')}</span>
          <span>{t('footer.dataSource')}</span>
          <span>{t('footer.classification')}</span>
        </div>
      </footer>
    </div>
  );
}
