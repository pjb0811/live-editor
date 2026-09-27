import type { Section } from '~/types';

import {
  createSectionPreviewCache,
  generateSectionPreview,
  generateSectionPreviews,
  getSections,
  parseDocument,
  replaceDocumentSections,
} from './ast/document';

export const extractSections = (code: string): Section[] => {
  const doc = parseDocument(code);

  return doc ? getSections(doc) : [];
};

export const replaceSections = (code: string, sections: string[]): string => {
  return replaceDocumentSections(code, sections);
};

export const generateSection = (code: string, fullCode: string) => {
  return generateSectionPreview(fullCode, code);
};

// Batched form of generateSection() — computes every section's preview from
// a single parse of fullCode instead of one parseDocument call per section
// (see generateSectionPreviews). Unchanged sections come back byte-identical
// to their previous preview string, which is what lets a caller pass each
// one down as a stable prop (see Renderer's React.memo).
export const generateSections = (
  codes: string[],
  fullCode: string,
): string[] => {
  return generateSectionPreviews(fullCode, codes);
};

// Incremental counterpart to generateSections() — see createSectionPreviewCache
// (#131). Pass a fresh instance's `compute` in place of generateSections()
// where the caller can keep it alive across renders (e.g. Dnd holds one via
// `useState(() => createSectionPreviewCache())`).
export { createSectionPreviewCache };
export type { SectionPreviewCache } from './ast/document';
