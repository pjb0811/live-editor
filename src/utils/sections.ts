import { DEFAULT_CONTAINER_ID, documentTemplate } from '~/constants';
import type { Section } from '~/types';

import {
  type DocumentOptions,
  type SectionOptions,
  createSectionPreviewCache,
  generateSectionPreview,
  generateSectionPreviews,
  getSections,
  parseDocument,
  replaceDocumentSections,
} from './ast/document';

export const extractSections = (
  code: string,
  options?: SectionOptions,
): Section[] => {
  const doc = parseDocument(code, options);

  return doc ? getSections(doc, options) : [];
};

export const replaceSections = (
  code: string,
  sections: string[],
  options?: DocumentOptions,
): string => {
  return replaceDocumentSections(code, sections, options);
};

export const generateSection = (
  code: string,
  fullCode: string,
  options?: DocumentOptions,
) => {
  return generateSectionPreview(fullCode, code, options);
};

// Batched form of generateSection() — computes every section's preview from
// a single parse of fullCode instead of one parseDocument call per section
// (see generateSectionPreviews). Unchanged sections come back byte-identical
// to their previous preview string, which is what lets a caller pass each
// one down as a stable prop (see Renderer's React.memo).
export const generateSections = (
  codes: string[],
  fullCode: string,
  options?: DocumentOptions,
): string[] => {
  return generateSectionPreviews(fullCode, codes, options);
};

// A new, empty document `Live.Dnd` can add sections to: an `App` component
// rendering the container element and nothing else. Start a controlled
// `Live.Dnd` from this rather than an empty string, which has no container,
// so nothing dropped on the canvas would land anywhere (#449). Pass the same
// `containerId` you give `Live.Dnd`.
export const createDocument = ({
  containerId = DEFAULT_CONTAINER_ID,
}: DocumentOptions = {}): string => {
  // The id is written into a JSX attribute as-is, so anything that could end
  // the attribute or the tag is refused rather than producing broken source.
  if (!/^[^\s"'<>{}]+$/.test(containerId)) {
    throw new Error(
      `createDocument: containerId must be a plain element id, got ${JSON.stringify(containerId)}`,
    );
  }

  return documentTemplate(containerId);
};

// Incremental counterpart to generateSections() — see createSectionPreviewCache
// (#131). Pass a fresh instance's `compute` in place of generateSections()
// where the caller can keep it alive across renders (e.g. Dnd holds one via
// `useState(() => createSectionPreviewCache())`).
export { createSectionPreviewCache };
export type {
  DocumentOptions,
  SectionOptions,
  SectionPreviewCache,
} from './ast/document';
