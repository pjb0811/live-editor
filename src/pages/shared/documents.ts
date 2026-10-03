import { DEFAULT_TEMPLATE } from '~/constants';
import type { Section } from '~/types';
import { replaceSections } from '~/utils/sections';

// A document that already holds `sections`, so a page opens with something
// to select instead of an empty canvas.
export const documentWith = (sections: Section[]) =>
  replaceSections(
    DEFAULT_TEMPLATE,
    sections.map(section => section.code),
  );
