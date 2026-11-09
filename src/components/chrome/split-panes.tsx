import { useRef, useState } from 'react';

import styles from './split-panes.module.css';

// Percentages of the container's width.
const DEFAULT_SIZE = 20;
const MIN_SIZE = 15;
const MAX_SIZE = 35;
const KEYBOARD_STEP = 2;

type Side = 'start' | 'end';

interface Props {
  start: React.ReactNode;
  center: React.ReactNode;
  end: React.ReactNode;
  labels: Record<Side, string>;
}

// Clamps a dragged size to the pane's range. Dragged below half the minimum,
// the pane collapses to nothing.
const clampSize = (size: number) => {
  if (size < MIN_SIZE / 2) {
    return 0;
  }

  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, size));
};

// Three panes side by side, with a handle between each side pane and the
// center one. A handle resizes its side pane by dragging, by the arrow keys
// or Home and End, and Enter collapses or restores it. The center pane takes
// what is left.
const SplitPanes = ({ start, center, end, labels }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [sizes, setSizes] = useState<Record<Side, number>>({
    start: DEFAULT_SIZE,
    end: DEFAULT_SIZE,
  });
  // The size a collapsed pane goes back to.
  const restoreRef = useRef<Record<Side, number>>({
    start: DEFAULT_SIZE,
    end: DEFAULT_SIZE,
  });

  const resize = (side: Side, size: number) => {
    if (size > 0) {
      restoreRef.current[side] = size;
    }

    setSizes(prev => ({ ...prev, [side]: size }));
  };

  const onPointerDown =
    (side: Side) => (e: React.PointerEvent<HTMLElement>) => {
      const container = containerRef.current;

      if (!container || e.button !== 0) {
        return;
      }

      e.preventDefault();

      const handle = e.currentTarget;
      const width = container.getBoundingClientRect().width;
      const startX = e.clientX;
      const startSize = sizes[side];

      handle.setPointerCapture(e.pointerId);

      const onMove = (move: PointerEvent) => {
        const delta = ((move.clientX - startX) / width) * 100;

        resize(
          side,
          clampSize(startSize + (side === 'start' ? delta : -delta)),
        );
      };

      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    };

  const onKeyDown = (side: Side) => (e: React.KeyboardEvent) => {
    // The arrow that moves the handle toward the center grows the pane.
    const grow = side === 'start' ? 'ArrowRight' : 'ArrowLeft';
    const shrink = side === 'start' ? 'ArrowLeft' : 'ArrowRight';
    const size = sizes[side];

    if (e.key === grow || e.key === shrink) {
      e.preventDefault();

      const step = e.key === grow ? KEYBOARD_STEP : -KEYBOARD_STEP;

      resize(side, Math.min(MAX_SIZE, Math.max(MIN_SIZE, size + step)));

      return;
    }

    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      resize(side, e.key === 'Home' ? MIN_SIZE : MAX_SIZE);

      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      resize(side, size > 0 ? 0 : restoreRef.current[side]);
    }
  };

  const handle = (side: Side) => (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={labels[side]}
      aria-valuenow={Math.round(sizes[side])}
      aria-valuemin={0}
      aria-valuemax={MAX_SIZE}
      className={styles.handle}
      onPointerDown={onPointerDown(side)}
      onKeyDown={onKeyDown(side)}
      onDoubleClick={() =>
        resize(side, sizes[side] > 0 ? 0 : restoreRef.current[side])
      }
    />
  );

  return (
    <div ref={containerRef} className={styles.container}>
      <div
        className={styles.pane}
        style={{ flexBasis: `${sizes.start}%` }}
        hidden={sizes.start === 0}
      >
        {start}
      </div>
      {handle('start')}
      <div className={styles.center}>{center}</div>
      {handle('end')}
      <div
        className={styles.pane}
        style={{ flexBasis: `${sizes.end}%` }}
        hidden={sizes.end === 0}
      >
        {end}
      </div>
    </div>
  );
};

export default SplitPanes;
