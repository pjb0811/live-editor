import { useEffect, useRef } from 'react';

import type { Section } from '~/types';

interface Options {
  sections: Section[];
  remove: (id: string) => void;
  onBeforeDelete?: (section: Section) => boolean | Promise<boolean>;
}

// Deleting a section, from the canvas, the panel or a custom panel's
// `onDelete`. Asks `onBeforeDelete` first when there is one, then removes the
// section. `onDeleted` runs only once it's actually gone (#435).
export const useDeleteFlow = ({
  sections,
  remove,
  onBeforeDelete,
}: Options) => {
  // Read through a ref after an async `onBeforeDelete`: while a confirmation
  // is open the document can change, and the `remove` from the render that
  // asked would commit against the document as it was then.
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
