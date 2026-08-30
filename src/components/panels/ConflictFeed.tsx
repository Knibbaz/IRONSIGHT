'use client';

import { useEffect } from 'react';
import { useConflictFeed, timeAgo, useTick, useReadItems } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { usePanelTTS } from '@/lib/tts';
import SpeechToggle from '@/components/SpeechToggle';
import type { ConflictEvent } from '@/types';

const TYPE_COLORS: Record<string, string> = {
  STRIKE: 'var(--red)',
  DEFENSE: 'var(--green)',
  MILITARY: 'var(--amber)',
  DIPLOMATIC: 'var(--blue)',
  NUCLEAR: 'var(--purple)',
  REPORT: 'var(--text-secondary)',
};

export default function ConflictFeed() {
  const { data: rawEvents, loading } = useConflictFeed<ConflictEvent[]>('/api/conflicts', 180000);
  const t = useT();
  useTick(15000);
  const { isRead, markRead } = useReadItems();
  const { enabled, toggle, speak } = usePanelTTS();

  // Read newly reported events aloud when unmuted.
  useEffect(() => {
    if (!rawEvents || rawEvents.length === 0 || !enabled) return;
    for (const event of rawEvents.slice(0, 3)) {
      speak(`${event.type} ${event.location}. ${event.description}`, event.id);
    }
  }, [rawEvents, enabled, speak]);

  // Sort most recent first
  const events = rawEvents ? [...rawEvents].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ) : null;

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <span className="status-dot" style={{ background: 'var(--red)' }} />
        {t('conflictFeed.title')}
        <SpeechToggle enabled={enabled} onToggle={toggle} />
        <span className="ml-auto text-[9px] text-[var(--text-secondary)] font-normal normal-case tracking-normal">
          {events?.length || 0} {t('conflictFeed.events')}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="loading-shimmer h-14 rounded" />
            ))}
          </div>
        ) : events?.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-secondary)] text-xs">
            {t('conflictFeed.empty')}
          </div>
        ) : (
          events?.map((event, i) => {
            const color = TYPE_COLORS[event.type] || TYPE_COLORS.REPORT;
            const read = isRead(event.url);
            const row = (
              <div className="data-row flex items-start gap-2" style={{ opacity: read ? 0.5 : 1 }}>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0"
                  style={{
                    color,
                    backgroundColor: `${color}15`,
                    border: `1px solid ${color}30`,
                  }}
                >
                  {event.type}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {!read && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: color }}
                        title="Unread"
                      />
                    )}
                    <span className="text-[9px] text-[var(--text-secondary)]">
                      {event.location}
                    </span>
                    <span className="text-[9px] text-[var(--text-secondary)] ml-auto">
                      {timeAgo(event.date)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-tight text-[var(--text-primary)]">
                    {event.description}
                  </p>
                  <span className="text-[8px] text-[var(--text-secondary)]">
                    {t('conflictFeed.via')} {event.source}
                  </span>
                </div>
              </div>
            );

            if (!event.url) return <div key={i}>{row}</div>;
            return (
              <a
                key={i}
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:bg-[rgba(255,255,255,0.03)] cursor-pointer"
                onClick={() => markRead(event.url)}
              >
                {row}
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
