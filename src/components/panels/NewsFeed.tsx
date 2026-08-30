'use client';

import { useEffect } from 'react';
import { useConflictFeed, timeAgo, useTick, useReadItems } from '@/lib/hooks';
import { useConflict } from '@/lib/conflicts/context';
import { useT } from '@/lib/i18n';
import { usePanelTTS } from '@/lib/tts';
import SpeechToggle from '@/components/SpeechToggle';
import type { NewsItem } from '@/types';

export default function NewsFeed() {
  const { config } = useConflict();
  const t = useT();
  const SOURCE_COLORS = config.client.sourceColors;
  const { data: news, loading, lastUpdated } = useConflictFeed<NewsItem[]>('/api/news', 90000);
  useTick(15000);
  const { isRead, markRead } = useReadItems();
  const { enabled, toggle, speak } = usePanelTTS();

  // Read newly arriving headlines aloud when unmuted.
  useEffect(() => {
    if (!news || news.length === 0 || !enabled) return;
    for (const item of news.slice(0, 3)) {
      speak(`${item.source}. ${item.title}`, item.link);
    }
  }, [news, enabled, speak]);

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <span className="status-dot" />
        {t('news.title')}
        <SpeechToggle enabled={enabled} onToggle={toggle} />
        <span className="ml-auto text-[9px] text-[var(--text-secondary)] font-normal normal-case tracking-normal">
          {news?.length || 0} {t('news.items')} · {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="loading-shimmer h-12 rounded" />
            ))}
          </div>
        ) : (
          news?.map((item, i) => {
            const read = isRead(item.link);
            return (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="data-row flex items-start gap-2 hover:cursor-pointer block"
                onClick={() => markRead(item.link)}
                style={{ opacity: read ? 0.5 : 1 }}
              >
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0"
                  style={{
                    backgroundColor: SOURCE_COLORS[item.source] || '#555',
                    color: '#fff',
                  }}
                >
                  {item.source}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1.5">
                    {!read && (
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
                        style={{ background: 'var(--red)' }}
                      />
                    )}
                    <p className="text-[11px] leading-tight text-[var(--text-primary)] truncate">
                      {item.title}
                    </p>
                  </div>
                  <span className="text-[9px] text-[var(--text-secondary)]">
                    {timeAgo(item.pubDate)}
                  </span>
                </div>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
