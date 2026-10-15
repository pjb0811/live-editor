import { type RefObject, createContext } from 'react';

// The elements whose fields to mark, by `data-id`, and the scrolling box
// that keeps a newly marked one in view. A set, so a mode that selects
// several elements at once can mark them all (#643).
export interface ElementSelection {
  ids: ReadonlySet<string>;
  scrollRootRef?: RefObject<HTMLElement | null>;
}

export const ElementSelectionContext = createContext<ElementSelection>({
  ids: new Set(),
});
