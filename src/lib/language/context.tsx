'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Lang = 'en' | 'nl';

const STORAGE_KEY = 'ironsight-lang';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Always start from 'en' so server and first client render match
  // (avoids hydration mismatch); the persisted choice is applied in an effect.
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'nl') setLangState(stored);
    } catch {
      // localStorage unavailable — stay on default
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setLangState(prev => {
      const next: Lang = prev === 'en' ? 'nl' : 'en';
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
