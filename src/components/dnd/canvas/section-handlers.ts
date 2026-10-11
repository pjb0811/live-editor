import { createContext, useContext } from 'react';

export type SectionNavigation = 'previous' | 'next' | 'first' | 'last';

// What every canvas section shares: the element picker (#432) and keyboard
// navigation (#435). Each handler takes the section's id.
export interface SectionHandlers {
  // The element picker is on: sections can't be dragged, and the pointer
  // over one reports positions instead of selecting it.
  inspecting: boolean;
  onInspectMove: (
    section: HTMLElement,
    overlay: Element,
    x: number,
    y: number,
  ) => void;
  onInspectPick: (
    sectionId: string,
    section: HTMLElement,
    overlay: Element,
    x: number,
    y: number,
  ) => void;
  onInspectLeave: () => void;
  // Registers a section's focusable wrapper, so the canvas can move focus
  // to it.
  nodeRef: (sectionId: string) => (node: HTMLElement | null) => void;
  // Arrow keys and Home/End on a focused section, outside a drag.
  onNavigate: (sectionId: string, to: SectionNavigation) => void;
  // Delete or Backspace on a focused section.
  onDeleteKey: (sectionId: string) => void;
}

// Provided around the canvas only. The drag overlay's copy of a section
// renders outside it, so it registers no node and handles no keys.
export const SectionHandlersContext = createContext<SectionHandlers | null>(
  null,
);

export const useSectionHandlers = () => useContext(SectionHandlersContext);
