'use client';

import { useEffect } from 'react';
import { useConflictFeed, timeAgo, useTick, useReadItems, useSavedItems } from '@/lib/hooks';
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
  const { isSaved, toggleSave, savedOnly, toggleSavedOnly, savedCount } = useSavedItems();
  const { enabled, toggle, speak } = usePanelTTS();

  const items = savedOnly ? (news || []).filter(item => isSaved(item.link)) : news;

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
        {savedCount > 0 && (
          <button
            onClick={toggleSavedOnly}
            className="text-[11px] leading-none px-1 rounded hover:bg-[rgba(255,200,0,0.15)] transition-colors shrink-0"
            title={t('news.savedTitle', { count: savedCount })}
            style={{ color: savedOnly ? 'var(--amber)' : 'var(--text-secondary)' }}
          >
            {savedOnly ? '★' : '☆'} {savedCount}
          </button>
        )}
        <span className="ml-auto text-[9px] text-[var(--text-secondary)] font-normal normal-case tracking-normal">
          {items?.length || 0} {t('news.items')} · {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="loading-shimmer h-12 rounded" />
            ))}
          </div>
        ) : items?.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-secondary)] text-xs">
            {savedOnly ? t('news.noSaved') : ''}
          </div>
        ) : (
          items?.map((item, i) => {
            const read = isRead(item.link);
            const saved = isSaved(item.link);
            return (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="data-row flex items-start gap-2 hover:cursor-pointer block"
                onClick={() => markRead(item.link)}
                style={{ opacity: read && !saved ? 0.5 : 1 }}
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
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave(item.link); }}
                      className="text-[11px] leading-none ml-auto shrink-0 px-0.5 hover:scale-125 transition-transform"
                      title={saved ? 'Unsave' : 'Save'}
                    >
                      <span style={{ color: saved ? 'var(--amber)' : 'var(--text-secondary)' }}>
                        {saved ? '★' : '☆'}
                      </span>
                    </button>
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
