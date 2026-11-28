import type { Section } from '~/types';

// What `renderSectionToolbar` gets for the selected section: the same
// actions the built-in buttons run, so a host's buttons behave the same
// (#788).
export interface DndSectionToolbarArgs {
  section: Section;
  // The section's 0-based position on the canvas.
  index: number;
  // `false` for the first section, `true` otherwise.
  canMoveUp: boolean;
  // `false` for the last section, `true` otherwise.
  canMoveDown: boolean;
  // `true` while the document doesn't parse. The actions below then refuse
  // and call `onBlockedEdit`, as the built-in buttons do.
  readOnly: boolean;
  // Moves the section one place, and keeps focus on it at either end.
  moveUp: () => void;
  moveDown: () => void;
  // Copies the section below itself and selects the copy.
  duplicate: () => void;
  // Deletes the section after `onBeforeDelete`, if any, allows it.
  remove: () => void;
}

// Renders the buttons inside the selected section's toolbar, in place of the
// built-in move, duplicate and delete buttons. The toolbar itself, its
// place and the rule that only the selected section shows it stay
// `Live.Dnd`'s.
export type DndRenderSectionToolbar = (
  args: DndSectionToolbarArgs,
) => React.ReactNode;

// The host's buttons as a component of their own, so hooks called in
// `renderSectionToolbar` belong to it: the section around it renders it only
// while selected.
export const SectionToolbarSlot = ({
  render,
}: {
  render: () => React.ReactNode;
}) => <>{render()}</>;
