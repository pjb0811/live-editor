import { useEffect, useRef } from 'react';

import type { Section } from '~/types';

interface Options {
  sections: Section[];
  remove: (id: string) => void;
  onBeforeDelete?: (section: Section) => boolean | Promise<boolean>;
}

// Returns the function that deletes a section, from the canvas, the panel
// or a custom panel's `onDelete`. It asks `onBeforeDelete` first, when
// there is one. Its optional `onDeleted` runs only once the section is
// gone (#435).
export const useDeleteFlow = ({
  sections,
  remove,
  onBeforeDelete,
}: Options) => {
  // Read through a ref after an async `onBeforeDelete`: the document can
  // change while a confirmation is open, and an old `remove` would commit
  // against the old one.
  const removeRef = useRef(remove);

  useEffect(() => {
    removeRef.current = remove;
  });

  return (id: string, onDeleted?: () => void) => {
    const section = sections.find(candidate => candidate.id === id);

    if (!onBeforeDelete || !section) {
      remove(id);
      onDeleted?.();

      return;
    }

    const decide = (allowed: boolean) => {
      if (allowed) {
        removeRef.current(id);
        onDeleted?.();
      }
    };

    try {
      const answer = onBeforeDelete(section);

      if (typeof answer === 'boolean') {
        decide(answer);

        return;
      }

      answer.then(decide, error => {
        console.error('onBeforeDelete rejected; the section was kept', error);
      });
    } catch (error) {
      console.error('onBeforeDelete threw; the section was kept', error);
    }
  };
};
