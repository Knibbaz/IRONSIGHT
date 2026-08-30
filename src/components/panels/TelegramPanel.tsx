'use client';

import { useEffect } from 'react';
import { useConflictFeed, timeAgo, useSavedItems } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { usePanelTTS } from '@/lib/tts';
import SpeechToggle from '@/components/SpeechToggle';

interface TelegramPost {
  channel: string;
  channelLabel: string;
  color: string;
  postId: number;
  text: string;
  date: string;
  url: string;
}

interface TelegramData {
  posts: TelegramPost[];
  channels: string[];
  updated: string;
}

export default function TelegramPanel() {
  const { data, loading, lastUpdated } = useConflictFeed<TelegramData>('/api/telegram', 60000);
  const t = useT();
  const { enabled, toggle, speak } = usePanelTTS();
  const { isSaved, toggleSave, savedOnly, toggleSavedOnly, savedCount } = useSavedItems();

  const posts = savedOnly ? (data?.posts || []).filter(p => isSaved(`${p.channel}-${p.postId}`)) : data?.posts;

  // Read newly arriving posts aloud when unmuted (clip long messages).
  useEffect(() => {
    if (!data?.posts || data.posts.length === 0 || !enabled) return;
    for (const post of data.posts.slice(0, 3)) {
      const text = post.text.length > 220 ? `${post.text.slice(0, 220)}...` : post.text;
      speak(`${post.channelLabel}. ${text}`, `${post.channel}-${post.postId}`);
    }
  }, [data, enabled, speak]);

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <span className="status-dot" style={{ background: 'var(--cyan)' }} />
        {t('telegram.title')}
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
          {posts?.length || 0} {t('telegram.posts')} // {data?.channels.length || 0} {t('telegram.channels')}{lastUpdated ? ` // ${new Date(lastUpdated).toLocaleTimeString()}` : ''}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="loading-shimmer h-16 rounded" />
            ))}
          </div>
        ) : posts?.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-secondary)] text-xs">
            {savedOnly ? t('news.noSaved') : t('telegram.empty')}
          </div>
        ) : (
          posts?.map((post) => {
            const key = `${post.channel}-${post.postId}`;
            const saved = isSaved(key);
            return (
              <a
                key={key}
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block data-row hover:!bg-[rgba(0,212,255,0.05)] cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      color: post.color,
                      backgroundColor: `${post.color}15`,
                      border: `1px solid ${post.color}30`,
                    }}
                  >
                    {post.channelLabel}
                  </span>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave(key); }}
                    className="text-[11px] leading-none px-0.5 hover:scale-125 transition-transform shrink-0"
                    title={saved ? 'Unsave' : 'Save'}
                  >
                    <span style={{ color: saved ? 'var(--amber)' : 'var(--text-secondary)' }}>
                      {saved ? '★' : '☆'}
                    </span>
                  </button>
                  <span className="text-[9px] text-[var(--text-secondary)] ml-auto shrink-0">
                    {timeAgo(post.date)}
                  </span>
                </div>
                <p className="text-[11px] leading-snug text-[var(--text-primary)] line-clamp-3">
                  {post.text}
                </p>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
