import { createPortal } from 'react-dom';

// The outline drawn over the element under the pointer. Portaled to the host
// body with fixed coordinates: the canvas sets `transform`, which would make
// a fixed box inside it relative to the canvas instead of the viewport.
const InspectorHighlight = ({ rect }: { rect: DOMRect | null }) =>
  rect
    ? createPortal(
        <div
          aria-hidden
          data-dnd-inspector-highlight
          style={{
            position: 'fixed',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            pointerEvents: 'none',
            outline: '2px solid #3b82f6',
            outlineOffset: -1,
            background: 'rgba(59, 130, 246, 0.12)',
            zIndex: 2147483647,
          }}
        />,
        document.body,
      )
    : null;

export default InspectorHighlight;
