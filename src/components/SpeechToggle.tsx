'use client';

interface Props {
  enabled: boolean;
  onToggle: () => void;
  label?: string;
}

/** Small unmute/mute button for reading a panel's feed aloud. */
export default function SpeechToggle({ enabled, onToggle, label }: Props) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="text-[10px] leading-none px-1 rounded hover:bg-[rgba(0,212,255,0.1)] transition-colors shrink-0"
      title={enabled ? 'Mute this panel' : 'Read this panel aloud'}
      aria-pressed={enabled}
      aria-label={label || (enabled ? 'Mute panel' : 'Read panel aloud')}
    >
      {enabled ? '🔊' : '🔇'}
    </button>
  );
}