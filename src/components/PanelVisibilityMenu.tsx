'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';

interface Props {
  panelLabels: { id: string; label: string }[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
}

// Dropdown for hiding panels and finding them again — the hide ("✕") button
// on each panel removes it from the grid, this menu is the only way back.
export default function PanelVisibilityMenu({ panelLabels, hidden, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[9px] tracking-[1px] px-2 py-1 rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--cyan)] hover:border-[var(--cyan)] transition-colors"
        title={t('header.panelsTitle')}
      >
        {t('header.panels')}{hidden.size > 0 ? ` (${hidden.size})` : ''}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-52 max-h-96 overflow-y-auto rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-lg py-1 normal-case">
          {panelLabels.map(({ id, label }) => (
            <label
              key={id}
              className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.05)] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={!hidden.has(id)}
                onChange={() => onToggle(id)}
                className="accent-[var(--cyan)]"
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
