import { createContext, useContext } from 'react';

import type { DndPalette, DndPanel } from './types';

// The state a custom layout needs: where things go, not what they contain.
export interface DndLayout {
  // Whether the screen is at a mobile breakpoint, where the built-in layout
  // stacks the canvas and a tap on a palette item adds it.
  isMobile: boolean;
  // `null` when nothing is selected. The built-in layout uses it to open the
  // properties Drawer on mobile, where the panel has nowhere else to go.
  selectedId: string | null;
  clearSelection: () => void;
  // The palette Drawer's open state. Dnd owns it because adding an item
  // closes the Drawer; a layout only opens it.
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  // Why the document can't be edited right now, or `null`. `'parse-error'`
  // while the source doesn't parse: the canvas shows the last version that
  // did, read-only (#433). `'container-not-found'` when it has no container
  // element, so it has no sections (#449).
  documentError: 'parse-error' | 'container-not-found' | null;
}

// Everything `Live.Dnd` passes to its children, read through the three
// hooks below, so each component depends only on the part it uses.
// `canvas` is a node, not data: `Live.Dnd.Canvas` places it, and nothing
// else can produce it.
interface DndRegions extends DndLayout {
  palette: DndPalette;
  panel: DndPanel;
  canvas: React.ReactNode;
}

export const DndRegionContext = createContext<DndRegions | null>(null);

// Internal. `subject` names the caller as written, such as
// `<Live.Dnd.Palette />`, for the error thrown outside `Live.Dnd`.
export const useDndRegions = (subject: string): DndRegions => {
  const regions = useContext(DndRegionContext);

  if (!regions) {
    throw new Error(`${subject} must be used inside <Live.Dnd>.`);
  }

  return regions;
};

// The palette's items and the callback that adds one to the canvas. With
// `Live.Dnd.DraggableItem` for dragging, that's all a palette needs.
export const useDndPalette = (): DndPalette =>
  useDndRegions('useDndPalette()').palette;

// The selected section, its editable bindings, and the callbacks that
// commit edits: everything the built-in panel uses.
export const useDndPanel = (): DndPanel => useDndRegions('useDndPanel()').panel;

// The layout state.
export const useDndLayout = (): DndLayout => useDndRegions('useDndLayout()');
