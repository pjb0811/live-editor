import type { Section } from '~/types';

const PALETTE_SECTION = 'palette-section';

// The data a palette section carries while it's dragged. Written by
// `Live.Dnd.DraggableItem` and read back on drop, in the drag overlay, by
// the drop highlights and in screen-reader announcements, all through
// `paletteSectionOf`.
export const paletteDragData = (section: Section) => ({
  type: PALETTE_SECTION,
  section,
});

// The palette section being dragged, or `undefined` when the drag is
// something else, such as a canvas section.
export const paletteSectionOf = (
  data: { current?: unknown } | undefined,
): Section | undefined => {
  const current = data?.current as
    { type?: unknown; section?: Section } | undefined;

  return current?.type === PALETTE_SECTION ? current.section : undefined;
};
