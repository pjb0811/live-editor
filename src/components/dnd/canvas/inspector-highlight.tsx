import { useLayoutEffect, useRef } from 'react';

// The outline drawn over the element under the pointer, or the one a panel
// field edits. Rendered inside the canvas's scroll container, so it sits at
// the canvas's level: whatever covers the canvas, such as the mobile panel
// Drawer or a host's modal, covers the outline too, and it never shows
// outside the canvas. `rect` is in viewport coordinates and is converted to
// the container's, scroll included.
const InspectorHighlight = ({ rect }: { rect: DOMRect | null }) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = ref.current;
    const container = box?.closest<HTMLElement>('[data-frame-container]');

    if (!box || !rect || !container) {
      return;
    }

    const outer = container.getBoundingClientRect();

    box.style.left = `${rect.left - outer.left - container.clientLeft + container.scrollLeft}px`;
    box.style.top = `${rect.top - outer.top - container.clientTop + container.scrollTop}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
  }, [rect]);

  return rect ? (
    <div
      ref={ref}
      aria-hidden
      data-dnd-inspector-highlight
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        outline: '2px solid #3b82f6',
        outlineOffset: -1,
        background: 'rgba(59, 130, 246, 0.12)',
        // Above the sections and their toolbars (up to `z-60`), below the
        // element picker's button and the stale banner (`z-70`).
        zIndex: 65,
      }}
    />
  ) : null;
};

export default InspectorHighlight;
