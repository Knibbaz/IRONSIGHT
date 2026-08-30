'use client';

import { useCallback } from 'react';
import { useLanguage } from './language/context';

const en = {
  'header.tagline': 'OSINT COMMAND CENTER // UNCLASSIFIED',
  'header.theater': 'THEATER',
  'header.session': 'SESSION',
  'header.live': 'LIVE',
  'header.language': 'LANGUAGE',
  'header.switchTheater': 'Switch dashboard to {label}',
  'header.resetLayout': 'RESET LAYOUT',
  'header.resetLayoutTitle': 'Restore the default panel positions and sizes (only affects this browser)',
  'header.panels': 'PANELS',
  'header.panelsTitle': 'Show/hide panels',
  'clock.loading': 'Loading clocks...',
  'clock.zulu': 'ZULU',

  'metrics.wti': 'WTI CRUDE',
  'metrics.brent': 'BRENT',
  'metrics.natGas': 'NAT GAS',
  'metrics.threatLevel': 'THREAT LEVEL',

  'news.title': 'LIVE INTEL FEED',
  'news.items': 'items',

  'telegram.title': 'TELEGRAM OSINT (UNVERIFIED)',
  'telegram.posts': 'posts',
  'telegram.channels': 'channels',
  'telegram.empty': 'No recent Telegram posts',

  'conflictFeed.title': 'CONFLICT MONITOR',
  'conflictFeed.events': 'events',
  'conflictFeed.empty': 'No recent conflict events reported',
  'conflictFeed.via': 'via',

  'strikes.title': 'MISSILE / STRIKE TRACKER',
  'strikes.events': 'events',
  'strikes.empty': 'No strike events detected',

  'regional.title': 'REGIONAL THREAT MONITOR',
  'regional.active': 'active',

  'alerts.liveTracksInbound': 'LIVE TRACKS // {count} INBOUND',
  'alerts.incomingThreat': 'INCOMING THREAT DETECTED',
  'alerts.sirensActivated': '{system} sirens activated',
  'alerts.noSirens': 'No oblast air-raid sirens active · tracking {count} inbound threat{plural} above',
  'alerts.allClear': 'ALL CLEAR',
  'alerts.noActiveAlerts': 'No active alerts from {system}',
  'alerts.pollingLast': 'Polling every 5s • Last: {time}',
  'alerts.soundOn': 'Sound: ON',
  'alerts.soundOff': 'Sound: OFF',
  'alerts.clickToEnable': '(click anywhere to enable)',
  'alerts.soundAlertsOn': 'Sound alerts ON',
  'alerts.soundAlertsOff': 'Sound alerts OFF',

  'markets.title': 'DEFENSE & MARKETS',
  'markets.indices': 'INDICES',
  'markets.defenseContractors': 'DEFENSE CONTRACTORS',

  'crypto.title': 'CRYPTO MARKETS',

  'oil.title': 'ENERGY MARKETS',

  'flights.title': 'MIL AIRSPACE',
  'flights.milOfTotal': '{mil} mil / {total} total // adsb.lol',
  'flights.empty': 'No military aircraft detected on ADS-B',
  'flights.emptyHint': '(many mil flights disable transponders)',

  'flights.commercial': 'COMMERCIAL FLIGHTS',
  'flights.commercialStats': '{tracked} tracked // {deviating} deviating',
  'flights.commercialOfTotal': '{normal} normal / {total} total tracked',
  'flights.deviation': 'deviation',
  'flights.deviations': 'deviations',
  'flights.noDeviations': 'No deviations detected',
  'flights.commercialHint': 'Tracking watched airlines for route anomalies',

  'naval.title': 'NAVAL TRACKER',
  'naval.vessels': 'vessels // OSINT',

  'satellite.title': 'SAT THERMAL DETECT',
  'satellite.hotspots': 'HOTSPOTS',
  'satellite.highInt': 'HIGH INT',
  'satellite.flagged': 'FLAGGED',
  'satellite.empty': 'No thermal anomalies detected in region',

  'polymarket.title': 'PREDICTION MARKETS',
  'polymarket.marketsCount': '{count} markets // Polymarket',
  'polymarket.empty': 'No active prediction markets found',
  'polymarket.yes': 'YES',

  'footer.feeds': 'FEEDS: NEWS | GDELT | TELEGRAM | OPENSKY | OCHA | YAHOO FIN | {alertSystem} | NASA FIRMS | ADSB.LOL',
  'footer.refreshRates': 'ALERTS: 5s | NEWS: 2m | MARKETS: 5m',
  'footer.dataSource': 'ALL DATA: PUBLIC / OSINT',
  'footer.classification': 'CLASSIFICATION: UNCLASSIFIED // FOUO',
};

const nl: typeof en = {
  'header.tagline': 'OSINT COMMANDOCENTRUM // NIET-GERUBRICEERD',
  'header.theater': 'THEATER',
  'header.session': 'SESSIE',
  'header.live': 'LIVE',
  'header.language': 'TAAL',
  'header.switchTheater': 'Wissel dashboard naar {label}',
  'header.resetLayout': 'INDELING RESETTEN',
  'header.resetLayoutTitle': 'Herstel de standaard paneelposities en -groottes (geldt alleen voor deze browser)',
  'header.panels': 'PANELEN',
  'header.panelsTitle': 'Panelen tonen/verbergen',
  'clock.loading': 'Klokken laden...',
  'clock.zulu': 'ZULU',

  'metrics.wti': 'WTI RUWE OLIE',
  'metrics.brent': 'BRENT',
  'metrics.natGas': 'AARDGAS',
  'metrics.threatLevel': 'DREIGINGSNIVEAU',

  'news.title': 'LIVE NIEUWSFEED',
  'news.items': 'items',

  'telegram.title': 'TELEGRAM OSINT (ONGEVERIFIEERD)',
  'telegram.posts': 'berichten',
  'telegram.channels': 'kanalen',
  'telegram.empty': 'Geen recente Telegram-berichten',

  'conflictFeed.title': 'CONFLICTMONITOR',
  'conflictFeed.events': 'gebeurtenissen',
  'conflictFeed.empty': 'Geen recente conflictgebeurtenissen gemeld',
  'conflictFeed.via': 'via',

  'strikes.title': 'RAKET-/AANVALSTRACKER',
  'strikes.events': 'gebeurtenissen',
  'strikes.empty': 'Geen aanvalsgebeurtenissen gedetecteerd',

  'regional.title': 'REGIONALE DREIGINGSMONITOR',
  'regional.active': 'actief',

  'alerts.liveTracksInbound': 'LIVE TRACKS // {count} INKOMEND',
  'alerts.incomingThreat': 'INKOMENDE DREIGING GEDETECTEERD',
  'alerts.sirensActivated': '{system} sirenes geactiveerd',
  'alerts.noSirens': 'Geen luchtalarmen actief in oblasten · volg {count} inkomende dreiging{plural} hierboven',
  'alerts.allClear': 'ALLES VEILIG',
  'alerts.noActiveAlerts': 'Geen actieve alarmen van {system}',
  'alerts.pollingLast': 'Elke 5s bijgewerkt • Laatst: {time}',
  'alerts.soundOn': 'Geluid: AAN',
  'alerts.soundOff': 'Geluid: UIT',
  'alerts.clickToEnable': '(klik ergens om in te schakelen)',
  'alerts.soundAlertsOn': 'Geluidsalarm AAN',
  'alerts.soundAlertsOff': 'Geluidsalarm UIT',

  'markets.title': 'DEFENSIE & MARKTEN',
  'markets.indices': 'INDICES',
  'markets.defenseContractors': 'DEFENSIEBEDRIJVEN',

  'crypto.title': 'CRYPTOMARKTEN',

  'oil.title': 'ENERGIEMARKTEN',

  'flights.title': 'MIL LUCHTRUIM',
  'flights.milOfTotal': '{mil} mil / {total} totaal // adsb.lol',
  'flights.empty': 'Geen militaire vliegtuigen gedetecteerd op ADS-B',
  'flights.emptyHint': '(veel militaire vluchten schakelen transponders uit)',

  'flights.commercial': 'COMMERCIËLE VLICHTEN',
  'flights.commercialStats': '{tracked} gevolgd // {deviating} afwijkend',
  'flights.commercialOfTotal': '{normal} normaal / {total} totaal gevolgd',
  'flights.deviation': 'afwijking',
  'flights.deviations': 'afwijkingen',
  'flights.noDeviations': 'Geen afwijkingen gedetecteerd',
  'flights.commercialHint': 'Gevolgde luchtvaartmaatschappijen op route-afwijkingen',

  'naval.title': 'MARITIEME TRACKER',
  'naval.vessels': 'schepen // OSINT',

  'satellite.title': 'SAT WARMTEDETECTIE',
  'satellite.hotspots': 'HOTSPOTS',
  'satellite.highInt': 'HOGE INT',
  'satellite.flagged': 'GEMARKEERD',
  'satellite.empty': 'Geen thermische anomalieën gedetecteerd in regio',

  'polymarket.title': 'VOORSPELMARKTEN',
  'polymarket.marketsCount': '{count} markten // Polymarket',
  'polymarket.empty': 'Geen actieve voorspelmarkten gevonden',
  'polymarket.yes': 'JA',

  'footer.feeds': 'FEEDS: NIEUWS | GDELT | TELEGRAM | OPENSKY | OCHA | YAHOO FIN | {alertSystem} | NASA FIRMS | ADSB.LOL',
  'footer.refreshRates': 'ALARMEN: 5s | NIEUWS: 2m | MARKTEN: 5m',
  'footer.dataSource': 'ALLE DATA: PUBLIEK / OSINT',
  'footer.classification': 'CLASSIFICATIE: NIET-GERUBRICEERD // FOUO',
};

export const translations = { en, nl };

export type TranslationKey = keyof typeof en;

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined ? String(vars[key]) : `{${key}}`));
}

export function useT() {
  const { lang } = useLanguage();
  return useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) =>
      interpolate(translations[lang][key] ?? translations.en[key] ?? key, vars),
    [lang]
  );
}
