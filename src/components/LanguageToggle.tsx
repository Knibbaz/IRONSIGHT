'use client';

import { useLanguage } from '@/lib/language/context';
import { useT } from '@/lib/i18n';

const LANGS: { key: 'en' | 'nl'; label: string }[] = [
  { key: 'en', label: 'EN' },
  { key: 'nl', label: 'NL' },
];

// Segmented control that switches the UI language and the translation
// target for live feed content (news, Telegram, conflict/strike/alert titles).
export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  const t = useT();

  return (
    <div className="flex items-center gap-1">
      <span className="text-[8px] text-[var(--text-secondary)] tracking-[2px] hidden md:inline">
        {t('header.language')}
      </span>
      <div className="flex items-center rounded border border-[var(--border-color)] overflow-hidden">
        {LANGS.map(({ key, label }) => {
          const active = key === lang;
          return (
            <button
              key={key}
              onClick={() => setLang(key)}
              className="text-[9px] font-bold tracking-[1px] px-2 py-1 transition-colors"
              style={{
                color: active ? '#0a0e17' : 'var(--text-secondary)',
                background: active ? 'var(--cyan)' : 'transparent',
              }}
              title={label}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
