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

// Caches the outcome for a source string, success or failure — `null` marks
// a cached failure (bad syntax, or no app-container), distinct from
// `undefined` meaning "not looked up yet" (createBoundedCache.get()'s own
// miss signal). Without this, an in-progress syntax error (the document
// mid-edit, before the next keystroke fixes it) would get re-parsed from
// scratch by every one of the N call sites that ask for it on every render
// (#97) — parsing determines nothing here except whether it throws, so
// there's no separate "did it parse" fact to cache apart from the result.
const documentCache = createBoundedCache<string, DocumentTree | null>(
  CONFIG.DOCUMENT_CACHE_LIMIT,
);

const buildDocument = (code: string): DocumentTree | undefined => {
  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const container = findContainer(ast);

    return container ? { code, ast, container } : undefined;
  } catch (e) {
    console.warn('⚠️ Failed to parse document', e);
    return undefined;
  }
};

// Parses the whole source once into a single Babel AST — the shared "document
// tree" that section-level (this file) and field-level (extract.ts/update.ts)
// operations both read via @babel/* instead of the previous regex-based
// section slicing living in a separate, conflicting parser.
//
// document.ts locates positions in the *original* source (section start/end
// offsets, the container's opening/closing tag positions) and edits by
// slicing that string — see replaceDocumentSections/generateSectionPreview
// below. It never round-trips through @babel/generator and never mutates
// the parsed tree, so every caller can safely share the same cached
// DocumentTree: unlike an approach that hands out a tree for the caller to
// edit in place, a cache hit here needs no clone at all.
export const parseDocument = (code: string): DocumentTree | undefined => {
  const cached = documentCache.get(code);

  if (cached !== undefined) {
    return cached ?? undefined;
  }

  const doc = buildDocument(code);

  documentCache.set(code, doc ?? null);

  return doc;
};

export const clearDocumentParseCache = () => {
  documentCache.clear();
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

// Length of the run at the start of `a`/`b` where elements are equal
// (by exact string value), e.g. commonPrefixLength(['a','b','x'], ['a','b','y']) === 2.
const commonPrefixLength = (a: string[], b: string[]): number => {
  const max = Math.min(a.length, b.length);
  let i = 0;

  while (i < max && a[i] === b[i]) {
    i++;
  }

  return i;
};

// Same as commonPrefixLength but from the end, bounded by `limit` so it
// can't reclaim elements the prefix already matched.
const commonSuffixLength = (
  a: string[],
  b: string[],
  limit: number,
): number => {
  let i = 0;

  while (i < limit && a[a.length - 1 - i] === b[b.length - 1 - i]) {
    i++;
  }

  return i;
};

// Replaces the container's <section> children with `sectionCodes`. Rather
// than treating "all the sections" as one contiguous block to overwrite —
// which silently deleted whatever sat between them, including entire
// wrapper elements around sections that live in different parents (#102) —
// this diffs the old and new section-code lists by common prefix/suffix
// (matching by exact content, same idea as a line-based text diff) and only
// touches the byte range spanning the run that actually changed. Everything
// outside that run — unchanged leading/trailing sections and all
// non-section content around them, including different wrappers — is left
// byte-for-byte untouched. A no-op call (sectionCodes identical to the
// current sections) touches nothing at all.
//
// This doesn't reach full minimal-diff generality for content that's
// simultaneously reordered *and* unchanged (e.g. swapping two sections with
// nothing else different still replaces the whole swapped run, so content
// sitting between them isn't preserved) — every real caller (dnd.tsx) only
// ever performs one edit/add/delete/reorder per call, which this handles
// precisely; see #102 for the general case this doesn't cover.
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

  if (sections.length === 0) {
    // No existing sections to diff against — append after whatever the
    // container already holds (e.g. a still-empty <main id="app-container">)
    // instead of discarding it.
    const span = getContainerInnerSpan(doc.container);

    return span
      ? spliceCode(fullCode, span.end, span.end, sectionCodes.join('\n'))
      : fullCode;
  }

  const oldCodes = sections.map(node => fullCode.slice(node.start!, node.end!));

  const prefixLength = commonPrefixLength(oldCodes, sectionCodes);
  const suffixLength = commonSuffixLength(
    oldCodes,
    sectionCodes,
    Math.min(oldCodes.length, sectionCodes.length) - prefixLength,
  );

  const oldChangedStart = prefixLength;
  const oldChangedEndExclusive = oldCodes.length - suffixLength;
  const newChanged = sectionCodes.slice(
    prefixLength,
    sectionCodes.length - suffixLength,
  );

  if (oldChangedStart >= oldChangedEndExclusive) {
    // Nothing removed — either a pure no-op (newChanged also empty) or a
    // pure insertion, anchored right before the first untouched section
    // that follows it (or after the last section, if inserted at the end).
    if (newChanged.length === 0) {
      return fullCode;
    }

    if (oldChangedStart < sections.length) {
      const at = sections[oldChangedStart]!.start!;

      return spliceCode(fullCode, at, at, `${newChanged.join('\n')}\n`);
    }

    const at = sections[sections.length - 1]!.end!;

    return spliceCode(fullCode, at, at, `\n${newChanged.join('\n')}`);
  }

  const start = sections[oldChangedStart]!.start!;
  const end = sections[oldChangedEndExclusive - 1]!.end!;

  return spliceCode(fullCode, start, end, newChanged.join('\n'));
};

// Produces a document whose container holds only `sectionCode`, discarding
// any other container content — used for Renderer's isolated per-section
// preview compile, not as a general-purpose section-list edit.
export const generateSectionPreview = (
  fullCode: string,
  sectionCode: string,
): string => generateSectionPreviews(fullCode, [sectionCode])[0]!;

// Same as generateSectionPreview, but for every section in one call —
// parses `fullCode` once and reuses the same container span for each,
// instead of the N separate parseDocument calls one-at-a-time callers would
// otherwise make per render (#97). Each entry only depends on the
// container's surrounding code and that one section's own code, so an
// unrelated edit elsewhere in `sectionCodes` still yields byte-identical
// strings for the sections that didn't change — letting a caller pass
// each one down as a stable prop instead of forcing every section to
// recompute (and, with React.memo, re-render) on every edit.
export const generateSectionPreviews = (
  fullCode: string,
  sectionCodes: string[],
): string[] => {
  const doc = parseDocument(fullCode);
  const span = doc && getContainerInnerSpan(doc.container);

  if (!span) {
    return sectionCodes.map(() => fullCode);
  }

  return sectionCodes.map(sectionCode =>
    spliceCode(fullCode, span.start, span.end, sectionCode),
  );
};
