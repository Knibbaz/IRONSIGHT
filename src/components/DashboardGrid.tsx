'use client';

import { useEffect, useRef, useState } from 'react';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { COLS, ROW_UNITS, MOBILE_ROW_HEIGHT, PANEL_LABELS } from '@/lib/layout';

const ReactGridLayout = WidthProvider(GridLayout);

const MARGIN = 4;
const HEADER_HEIGHT = 34;

interface Props {
  panels: { id: string; node: React.ReactNode }[];
  layout: Layout[];
  onLayoutChange: (next: Layout[]) => void;
  hidden: Set<string>;
  onHidePanel: (id: string) => void;
  /** Stacked single-column layout, no shrink-to-fit. */
  isMobile: boolean;
  /** When off, panels are fixed — no accidental drags while scrolling. */
  editMode: boolean;
}

export default function DashboardGrid({ panels, layout, onLayoutChange, hidden, onHidePanel, isMobile, editMode }: Props) {
  const containerRef = useRef<HTMLElement>(null);
  const [rowHeight, setRowHeight] = useState(16);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);

  const visiblePanels = panels.filter((p) => !hidden.has(p.id));
  const visibleLayout = layout.filter((item) => !hidden.has(item.i));
  const fullscreenPanel = panels.find((p) => p.id === fullscreenId) || null;

  // Close the fullscreen overlay with Escape.
  useEffect(() => {
    if (!fullscreenId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreenId]);

  // RGL only knows about the currently-rendered (visible) items, so merge its
  // updates back into the full layout — otherwise hidden panels would lose
  // their saved position/size the next time a visible panel is moved.
  const handleLayoutChange = (next: Layout[]) => {
    // On mobile the parent derives a fresh order from `next` directly.
    if (isMobile) {
      onLayoutChange(next);
      return;
    }
    const merged = layout.map((item) => {
      const updated = next.find((n) => n.i === item.i);
      return updated ? { ...item, ...updated } : item;
    });
    onLayoutChange(merged);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (isMobile) {
      setRowHeight(MOBILE_ROW_HEIGHT);
      return;
    }

    const update = () => {
      const h = el.clientHeight;
      if (h > 0) {
        setRowHeight(Math.max(4, (h - (ROW_UNITS - 1) * MARGIN) / ROW_UNITS));
      }
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);

  return (
    <main
      ref={containerRef}
      className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1 ${editMode ? 'dash-editable' : ''}`}
    >
      <ReactGridLayout
        layout={visibleLayout}
        onLayoutChange={handleLayoutChange}
        cols={isMobile ? 1 : COLS}
        rowHeight={rowHeight}
        margin={[MARGIN, MARGIN]}
        containerPadding={[0, 0]}
        draggableHandle=".panel-header"
        draggableCancel="button, a, input"
        resizeHandles={isMobile ? [] : ['se']}
        isDraggable={editMode}
        isResizable={editMode && !isMobile}
        compactType="vertical"
        isBounded
        useCSSTransforms
      >
        {visiblePanels.map((p) => (
          <div key={p.id} className="min-h-0 relative">
            {p.id === fullscreenId ? (
              // The panel's real content lives in the overlay while fullscreen —
              // keep a placeholder in the grid so the slot keeps its size.
              <div className="h-full flex items-center justify-center text-[10px] text-[var(--text-secondary)]">
                {PANEL_LABELS.find(l => l.id === p.id)?.label ?? p.id} — fullscreen
              </div>
            ) : (
              p.node
            )}
            {p.id !== fullscreenId && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setFullscreenId(p.id); }}
                  className={`absolute top-0 ${editMode ? 'right-6' : 'right-1'} z-20 flex items-center text-[12px] leading-none text-[var(--text-secondary)] hover:text-[var(--cyan)] transition-colors`}
                  style={{ height: HEADER_HEIGHT }}
                  title="Fullscreen"
                >
                  ⛶
                </button>
                {editMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onHidePanel(p.id); }}
                    className="absolute top-0 right-1 z-20 flex items-center text-[13px] leading-none text-[var(--text-secondary)] hover:text-[var(--red)] transition-colors"
                    style={{ height: HEADER_HEIGHT }}
                    title="Hide panel"
                  >
                    ✕
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </ReactGridLayout>

      {/* Fullscreen overlay */}
      {fullscreenPanel && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-primary)]">
          <div
            className="shrink-0 flex items-center justify-between px-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]"
            style={{ height: HEADER_HEIGHT }}
          >
            <span className="text-[11px] font-bold tracking-[2px] text-[var(--cyan)]">
              {PANEL_LABELS.find(l => l.id === fullscreenPanel.id)?.label ?? fullscreenPanel.id}
            </span>
            <button
              onClick={() => setFullscreenId(null)}
              className="text-[11px] tracking-[1px] px-2 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--cyan)] hover:border-[var(--cyan)] transition-colors"
            >
              ✕ {fullscreenId === fullscreenPanel.id ? 'Close' : ''}
            </button>
          </div>
          <div className="flex-1 min-h-0">
            {fullscreenPanel.node}
          </div>
        </div>
      )}
    </main>
  );
}
