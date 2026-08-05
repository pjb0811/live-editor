import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

import { CONFIG } from '../../constants';
import type { Section } from '../../types';
import { createBoundedCache } from '../cache';

const APP_CONTAINER_ID = 'app-container';
const SECTION_TAG = 'section';
const DATA_NAME_ATTR = 'data-name';

export interface DocumentTree {
  code: string;
  ast: t.File;
  container: t.JSXElement;
}

const getTagName = (element: t.JSXElement): string => {
  const name = element.openingElement.name;
  return t.isJSXIdentifier(name) ? name.name : '';
};

const getAttrValue = (
  element: t.JSXElement,
  attrName: string,
): string | undefined => {
  const attr = element.openingElement.attributes.find(
    (a): a is t.JSXAttribute =>
      t.isJSXAttribute(a) &&
      t.isJSXIdentifier(a.name) &&
      a.name.name === attrName,
  );

  return attr && t.isStringLiteral(attr.value) ? attr.value.value : undefined;
};

const isSectionElement = (node: t.Node): node is t.JSXElement =>
  t.isJSXElement(node) && getTagName(node) === SECTION_TAG;

const findContainer = (ast: t.File): t.JSXElement | undefined => {
  let container: t.JSXElement | undefined;

  traverse(ast, {
    JSXElement(path) {
      if (getAttrValue(path.node, 'id') === APP_CONTAINER_ID) {
        container = path.node;
        path.stop();
      }
    },
  });

  return container;
};

// Recursively finds every *outermost* <section> under a container — a
// <section> nested inside another <section> is left to its parent, so the
// document's section count stays unambiguous (matches how the old
// regex-based path treated nesting, and how #96 asked for it).
const findOutermostSections = (
  children: t.JSXElement['children'],
): t.JSXElement[] => {
  const sections: t.JSXElement[] = [];

  for (const child of children) {
    if (isSectionElement(child)) {
      sections.push(child);
      continue;
    }

    if (t.isJSXElement(child) || t.isJSXFragment(child)) {
      sections.push(...findOutermostSections(child.children));
    }
  }

  return sections;
};

const parseCache = createBoundedCache<string, t.File>(CONFIG.CACHE_LIMIT);

// document.ts locates positions in the *original* source (section start/end
// offsets, the container's opening/closing tag positions) and edits by
// slicing that string — see replaceDocumentSections/generateSectionPreview
// below. It never round-trips through @babel/generator and never mutates
// the parsed tree, so every caller can safely share one cached AST: unlike
// an approach that hands out a tree for the caller to edit in place, a
// cache hit here needs no clone at all.
const parseSource = (code: string): t.File => {
  const cached = parseCache.get(code);

  if (cached) {
    return cached;
  }

  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  parseCache.set(code, ast);

  return ast;
};

// Parses the whole source once into a single Babel AST — the shared "document
// tree" that section-level (this file) and field-level (extract.ts/update.ts)
// operations both read via @babel/* instead of the previous regex-based
// section slicing living in a separate, conflicting parser.
export const parseDocument = (code: string): DocumentTree | undefined => {
  try {
    const ast = parseSource(code);
    const container = findContainer(ast);

    return container ? { code, ast, container } : undefined;
  } catch (e) {
    console.warn('⚠️ Failed to parse document', e);
    return undefined;
  }
};

export const clearDocumentParseCache = () => {
  parseCache.clear();
};

export const getSections = (doc: DocumentTree): Section[] =>
  findOutermostSections(doc.container.children).map((node, index) => ({
    id: `${index}`,
    name: getAttrValue(node, DATA_NAME_ATTR) || `${index + 1}번째 컴포넌트`,
    code: doc.code.slice(node.start!, node.end!),
  }));

export const generateDocumentCode = (doc: DocumentTree): string => doc.code;

// The span of source text occupied by `container`'s children — right after
// its opening tag's `>` through right before its closing tag's `<`.
// undefined for a self-closing container, which has no children slot.
const getContainerInnerSpan = (
  container: t.JSXElement,
): { start: number; end: number } | undefined => {
  if (!container.closingElement) {
    return undefined;
  }

  return {
    start: container.openingElement.end!,
    end: container.closingElement.start!,
  };
};

const spliceCode = (
  code: string,
  start: number,
  end: number,
  replacement: string,
): string => code.slice(0, start) + replacement + code.slice(end);

// Replaces the container's <section> children with `sectionCodes`, leaving
// everything else in the file — non-section content before/after the
// sections, and anything outside the container entirely — byte-for-byte
// untouched (no whole-file reformatting, no reordering; see #96). Content
// interspersed *between* the original sections is not separately preserved:
// the whole span from the first section's start to the last section's end
// is replaced as one block, since `sectionCodes` is a flat replacement list
// with no way to say where such content should land in the new order.
//
// `sectionCodes` are spliced in as raw text with no parsing or validation:
// an invalid entry still lands in the output rather than being silently
// dropped, and gets surfaced through the normal compile-error path instead
// of vanishing (#96).
export const replaceDocumentSections = (
  fullCode: string,
  sectionCodes: string[],
): string => {
  const doc = parseDocument(fullCode);

  if (!doc) {
    return fullCode;
  }

  const sections = findOutermostSections(doc.container.children);
  const replacement = sectionCodes.join('\n');

  if (sections.length > 0) {
    const start = sections[0]!.start!;
    const end = sections[sections.length - 1]!.end!;

    return spliceCode(fullCode, start, end, replacement);
  }

  // No existing sections to anchor a replacement span on — append after
  // whatever the container already holds (e.g. a still-empty
  // <main id="app-container">) instead of discarding it.
  const span = getContainerInnerSpan(doc.container);

  return span
    ? spliceCode(fullCode, span.end, span.end, replacement)
    : fullCode;
};

// Produces a document whose container holds only `sectionCode`, discarding
// any other container content — used for Renderer's isolated per-section
// preview compile, not as a general-purpose section-list edit.
export const generateSectionPreview = (
  fullCode: string,
  sectionCode: string,
): string => {
  const doc = parseDocument(fullCode);
  const span = doc && getContainerInnerSpan(doc.container);

  return span
    ? spliceCode(fullCode, span.start, span.end, sectionCode)
    : fullCode;
};
