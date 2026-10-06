import { createContext } from 'react';

import type { Section } from '~/types';

export interface DndSectionFallbackArgs {
  section: Section;
  // `compile`: the section's code failed to compile. `runtime`: it threw
  // while rendering. `forced`: `shouldForceSectionFallback` returned true, so
  // it was never compiled.
  reason: 'compile' | 'runtime' | 'forced';
  // The compiler or runtime message. `undefined` for `forced`.
  message?: string;
}

// Return a node to show in the section's place, or `undefined` for the
// built-in error box.
export type DndRenderSectionFallback = (
  args: DndSectionFallbackArgs,
) => React.ReactNode | undefined;

// Read only by `SectionFallback`, which renders only for a failed section,
// so a new inline function each render never re-renders a working section
// (#97).
export const SectionFallbackContext = createContext<
  DndRenderSectionFallback | undefined
>(undefined);
