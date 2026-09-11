import { createContext, useContext } from 'react';

import type { DndPalette, DndPanel } from './dnd';

// The layout state a custom arrangement needs. Separate from the palette and
// panel data because a layout decides *where* things go, not what they
// contain — the built-in layout reads only this slice.
export interface DndLayout {
  // From `useResponsiveSize` — the same value that picks the stacked mobile
  // arrangement, so a custom layout can branch on it without repeating the
  // breakpoint check. Also what the built-in palette reads to decide
  // tap-to-add: at a mobile breakpoint a tap can't be a failed drag attempt
  // (there's nothing visible to drag onto behind the Drawer) and dblclick
  // synthesis from double-tap is unreliable, so a single tap adds.
  isMobile: boolean;
  // `null` when nothing is selected. The built-in layout uses it to open the
  // properties Drawer on mobile, where the panel has nowhere else to go.
  selectedId: string | null;
  clearSelection: () => void;
  // The palette Drawer's open state. Dnd owns it because adding an item
  // closes the Drawer; a layout only opens it.
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
}

// Everything `Live.Dnd` publishes to its children, read back through the
// three hooks below rather than as one object — a custom panel has no
// business seeing the palette's items, and narrow hooks say which part of
// Dnd a component actually depends on.
//
// `canvas` is the one node here rather than data: the droppable, the
// sortable list and each section's compiled iframe are Dnd's own machinery,
// so `Live.Dnd.Canvas` places it but nobody reproduces it.
interface DndRegions extends DndLayout {
  palette: DndPalette;
  panel: DndPanel;
  canvas: React.ReactNode;
}

export const DndRegionContext = createContext<DndRegions | null>(null);

// Internal, and takes a `subject` the public hooks don't: the caller as it
// appears in source — a hook call, or the region element that wraps one — so
// rendering `<Live.Dnd.Palette />` outside `Live.Dnd` reports the element the
// reader actually wrote rather than the hook behind it.
export const useDndRegions = (subject: string): DndRegions => {
  const regions = useContext(DndRegionContext);

  if (!regions) {
    throw new Error(`${subject} must be used inside <Live.Dnd>.`);
  }

  return regions;
};

// The palette's items and the callback that adds one to the canvas. Pair it
// with `Live.Dnd.DraggableItem` for the drag wiring and you have the whole
// built-in palette's input.
export const useDndPalette = (): DndPalette =>
  useDndRegions('useDndPalette()').palette;

// The selected section, its editable bindings, and the callbacks that commit
// through Dnd's AST-update pipeline — everything the built-in property panel
// runs on.
export const useDndPanel = (): DndPanel => useDndRegions('useDndPanel()').panel;

// Returns the context object itself, narrowed: identity is stable across
// renders, so this is safe in a dependency array.
export const useDndLayout = (): DndLayout => useDndRegions('useDndLayout()');
