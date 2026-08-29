'use client';

import { useEffect, useRef, useState } from 'react';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { COLS, ROW_UNITS } from '@/lib/layout';

const ReactGridLayout = WidthProvider(GridLayout);

const MARGIN = 4;
const HEADER_HEIGHT = 34;

interface Props {
  panels: { id: string; node: React.ReactNode }[];
  layout: Layout[];
  onLayoutChange: (next: Layout[]) => void;
  hidden: Set<string>;
  onHidePanel: (id: string) => void;
}

export default function DashboardGrid({ panels, layout, onLayoutChange, hidden, onHidePanel }: Props) {
  const containerRef = useRef<HTMLElement>(null);
  const [rowHeight, setRowHeight] = useState(16);

  const visiblePanels = panels.filter((p) => !hidden.has(p.id));
  const visibleLayout = layout.filter((item) => !hidden.has(item.i));

  // RGL only knows about the currently-rendered (visible) items, so merge its
  // updates back into the full layout — otherwise hidden panels would lose
  // their saved position/size the next time a visible panel is moved.
  const handleLayoutChange = (next: Layout[]) => {
    const merged = layout.map((item) => {
      const updated = next.find((n) => n.i === item.i);
      return updated ? { ...item, ...updated } : item;
    });
    onLayoutChange(merged);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

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
  }, []);

  return (
    <main ref={containerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1">
      <ReactGridLayout
        layout={visibleLayout}
        onLayoutChange={handleLayoutChange}
        cols={COLS}
        rowHeight={rowHeight}
        margin={[MARGIN, MARGIN]}
        containerPadding={[0, 0]}
        draggableHandle=".panel-header"
        draggableCancel="button, a, input"
        resizeHandles={['se']}
        compactType="vertical"
        isBounded
        useCSSTransforms
      >
        {visiblePanels.map((p) => (
          <div key={p.id} className="min-h-0 relative">
            {p.node}
            <button
              onClick={(e) => { e.stopPropagation(); onHidePanel(p.id); }}
              className="absolute top-0 right-1 z-20 flex items-center text-[13px] leading-none text-[var(--text-secondary)] hover:text-[var(--red)] transition-colors"
              style={{ height: HEADER_HEIGHT }}
              title="Hide panel"
            >
              ✕
            </button>
          </div>
        ))}
      </ReactGridLayout>
    </main>
  );
}
