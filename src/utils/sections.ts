import { DEFAULT_CONTAINER_ID, documentTemplate } from '~/constants';
import type { Section } from '~/types';

import {
  type DocumentOptions,
  type DocumentProblem,
  type SectionOptions,
  createSectionPreviewCache,
  generateSectionPreview,
  getSections,
  inspectDocument,
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

// Whether `Live.Dnd` can edit a document: it parses, and it has the
// container. A host can check one before saving or loading it, and gets the
// same reasons `Live.Dnd` reports through `onEditError` (#522).
export type DocumentCheck = { ok: true } | ({ ok: false } & DocumentProblem);

export const checkDocument = (
  code: string,
  options?: DocumentOptions,
): DocumentCheck => {
  const inspection = inspectDocument(code, options);

  if (inspection.ok) {
    return { ok: true };
  }

  // A copy: the inspection is cached and shared with `Live.Dnd`.
  return { ...inspection };
};

// Generates every section's preview from one parse and reuses an unchanged
// preview between calls (#131). Keep one instance per editor, as `Live.Dnd`
// does.
export { createSectionPreviewCache };
export type {
  DocumentOptions,
  DocumentProblem,
  SectionOptions,
} from './ast/document';
