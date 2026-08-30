'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from './language/context';

function pickVoice(lang: 'en' | 'nl'): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const want = lang === 'nl' ? 'nl' : 'en';
  return (
    voices.find(v => v.lang.toLowerCase().startsWith(want) && v.localService) ||
    voices.find(v => v.lang.toLowerCase().startsWith(want)) ||
    null
  );
}

/**
 * Per-panel text-to-speech. When enabled, feed items are read aloud in the
 * dashboard's current language (English -> en-US, Dutch -> nl-NL). Each item is
 * spoken once (tracked by an optional key); toggling speech off stops the queue
 * and clears the spoken-marker so items that arrive after re-enabling are read.
 */
export function usePanelTTS() {
  const { lang } = useLanguage();
  const [enabled, setEnabled] = useState(false);

  const enabledRef = useRef(false);
  enabledRef.current = enabled;
  const langRef = useRef(lang);
  langRef.current = lang;

  const spokenRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);

  const pump = useCallback(() => {
    if (speakingRef.current) return;
    if (!enabledRef.current) return;
    if (!('speechSynthesis' in window)) return;
    const next = queueRef.current.shift();
    if (!next) return;

    speakingRef.current = true;
    const utter = new SpeechSynthesisUtterance(next);
    utter.lang = langRef.current === 'nl' ? 'nl-NL' : 'en-US';
    const voice = pickVoice(langRef.current);
    if (voice) utter.voice = voice;
    utter.rate = 1.05;
    utter.onend = () => { speakingRef.current = false; pump(); };
    utter.onerror = () => { speakingRef.current = false; pump(); };
    window.speechSynthesis.speak(utter);
  }, []);

  const speak = useCallback((text: string, key?: string) => {
    if (!enabledRef.current || !text) return;
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    if (key && spokenRef.current.has(key)) return;
    if (key) {
      spokenRef.current.add(key);
      if (spokenRef.current.size > 500) {
        const arr = [...spokenRef.current];
        spokenRef.current = new Set(arr.slice(-500));
      }
    }
    queueRef.current.push(clean);
    if (queueRef.current.length > 6) queueRef.current = queueRef.current.slice(-6);
    pump();
  }, [pump]);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      if (!next) {
        queueRef.current = [];
        speakingRef.current = false;
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      }
      return next;
    });
  }, []);

  // Stop speaking if the panel unmounts or the language context is torn down.
  useEffect(() => () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  return { enabled, toggle, speak };
}