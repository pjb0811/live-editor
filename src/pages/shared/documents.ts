import { createUiKitDocument } from '~/components/ui-kit';
import type { Section } from '~/types';
import { replaceSections } from '~/utils/sections';

// A document that already holds `sections`, so a page opens with something
// to select instead of an empty canvas.
export const documentWith = (sections: Section[]) =>
  replaceSections(
    createUiKitDocument(),
    sections.map(section => section.code),
  );
