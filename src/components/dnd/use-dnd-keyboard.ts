import { useEffect, useState } from 'react';

import {
  type Announcements,
  KeyboardSensor,
  PointerSensor,
  type ScreenReaderInstructions,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import type { Section } from '~/types';

import type { SectionNavigation } from './sortable';

// Enter is left out of `start` so it can select the focused section (#435).
const KEYBOARD_CODES = {
  start: ['Space'],
  cancel: ['Escape'],
  end: ['Space', 'Enter'],
};

export const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'On a palette item, press Enter to add it to the canvas. On a canvas section, press Enter to select it, the up and down arrow keys to go to the previous or next section, and Delete to remove it. Press Space to pick a section up, the arrow keys to move it, and Space or Enter to drop it. Press Escape to cancel.',
};

// Section wrappers by id, with one stable ref callback per id so React
// doesn't detach and reattach every wrapper on each render. Held in a
// `useState` box and only read from handlers and effects.
const createNodeRegistry = () => {
  const nodes = new Map<string, HTMLElement>();
  const callbacks = new Map<string, (node: HTMLElement | null) => void>();

  return {
    get: (id: string) => nodes.get(id),
    register: (id: string) => {
      let callback = callbacks.get(id);

      if (!callback) {
        callback = node => {
          if (node) {
            nodes.set(id, node);
          } else {
            // A wrapper only detaches when its section leaves the canvas
            // (sections are keyed by id), so its callback can go too.
            nodes.delete(id);
            callbacks.delete(id);
          }
        };
        callbacks.set(id, callback);
      }

      return callback;
    },
  };
};

export type SectionNodes = ReturnType<typeof createNodeRegistry>;

interface Options {
  sections: Section[];
  selectedId: string | null;
  selectedIndex: number;
  selectOnly: (id: string) => void;
  move: (id: string | null, direction: 'up' | 'down') => void;
  requestDelete: (id: string, onDeleted?: () => void) => void;
}

// Everything the keyboard does on the canvas (#435): dnd-kit's sensors and
// what it announces, moving focus and selection between sections, Delete on
// a focused section, and keeping focus put when a move button disables
// itself (#505).
export const useDndKeyboard = ({
  sections,
  selectedId,
  selectedIndex,
  selectOnly,
  move,
  requestDelete,
}: Options) => {
  // Space picks a focused section up, the arrow keys move it, and Space or
  // Enter drops it (Escape cancels). Enter doesn't pick up, unlike dnd-kit's
  // default: a focused section is a `role="button"`, and Enter selects it
  // like a click does (see Sortable). Before, sections could be reached with
  // Tab but neither selected nor moved from the keyboard.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: KEYBOARD_CODES,
    }),
  );

  // dnd-kit announces drags by id, which here is a generated `data-id`.
  const nameOf = (id: string | number, data?: { current?: unknown }) => {
    const current = data?.current as { item?: Section } | undefined;

    return (
      current?.item?.name ??
      sections.find(section => section.id === id)?.name ??
      'section'
    );
  };

  const positionOf = (id: string | number) =>
    sections.findIndex(section => section.id === id) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id, active.data)}.`,
    onDragOver: ({ active, over }) =>
      over && positionOf(over.id) > 0
        ? `${nameOf(active.id, active.data)} moved to position ${positionOf(over.id)} of ${sections.length}.`
        : `${nameOf(active.id, active.data)} is no longer over a position.`,
    onDragEnd: ({ active, over }) =>
      over && positionOf(over.id) > 0
        ? `${nameOf(active.id, active.data)} dropped at position ${positionOf(over.id)} of ${sections.length}.`
        : `${nameOf(active.id, active.data)} dropped.`,
    onDragCancel: ({ active }) =>
      `Moving ${nameOf(active.id, active.data)} was cancelled.`,
  };

  // The focusable wrapper of each section, so the keyboard can move focus
  // between them.
  const [sectionNodes] = useState(createNodeRegistry);

  // `focus()` also scrolls the section into view.
  const focusSection = (id: string) => sectionNodes.get(id)?.focus();

  // Arrow keys and Home/End move focus to another section and select it, so
  // the panel follows. Outside a drag only: during one, dnd-kit owns them.
  const onNavigate = (fromId: string, to: SectionNavigation) => {
    const from = sections.findIndex(section => section.id === fromId);
    const index =
      to === 'first'
        ? 0
        : to === 'last'
          ? sections.length - 1
          : from + (to === 'next' ? 1 : -1);
    const target = sections[index];

    if (from < 0 || !target || target.id === fromId) {
      return;
    }

    selectOnly(target.id);
    focusSection(target.id);
  };

  // Delete on a focused section. Focus goes to the section that takes its
  // place (or the one before it, for the last), so it isn't dropped on the
  // page body.
  const onDeleteKey = (id: string) => {
    const index = sections.findIndex(section => section.id === id);
    const neighbor = sections[index + 1] ?? sections[index - 1];

    requestDelete(id, () => {
      if (neighbor) {
        focusSection(neighbor.id);
      }
    });
  };

  // A move to the first or last place disables the button just pressed, and
  // focus on a disabled button falls back to the document. Focusing the
  // section keeps a keyboard user where they were (#505).
  const onMoveButton = (id: string, direction: 'up' | 'down') => {
    const to =
      sections.findIndex(section => section.id === id) +
      (direction === 'up' ? -1 : 1);

    move(id, direction);

    if (to === 0 || to === sections.length - 1) {
      focusSection(id);
    }
  };

  // Keeps the selected section on screen when it moves out of view without
  // the keyboard taking it there: a move from the panel, or a copy that lands
  // below the fold. After the next frame, once the new order is laid out.
  useEffect(() => {
    if (selectedId === null) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      sectionNodes.get(selectedId)?.scrollIntoView?.({ block: 'nearest' });
    });

    return () => cancelAnimationFrame(frame);
  }, [sectionNodes, selectedId, selectedIndex]);

  return {
    sensors,
    announcements,
    sectionNodes,
    onNavigate,
    onDeleteKey,
    onMoveButton,
  };
};
