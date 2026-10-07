import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { TraverseOptions, Visitor } from '@babel/traverse';
import * as t from '@babel/types';
import { nanoid } from 'nanoid';

import { CONFIG, DATA_ATTR, DEFAULT_CONTAINER_ID } from '../../constants';
import type { Section } from '../../types';
import { createBoundedCache } from '../cache';
import { registerEditorCache } from '../editor-caches';
import { getJSXTagName } from './jsx-name';
import { fillIdsFrom } from './tree';

// `traverse` with the one call shape the AST layer uses. Import it from here,
// not from '@babel/traverse'.
type Traverse = (parent: t.Node, opts: TraverseOptions & Visitor) => void;

export const traverse: Traverse = _traverse;

const SECTION_TAG = 'section';
const DATA_NAME_ATTR = 'data-name';

export interface DocumentOptions {
  // The `id` of the element whose `<section>` children are the document's
  // sections. Defaults to `app-container`, the id `DEFAULT_TEMPLATE` and
  // `createDocument()` use (#449).
  containerId?: string;
}

export interface SectionOptions extends DocumentOptions {
  // Names a section that has no `data-name`, given its 0-based position
  // among the document's sections.
  sectionNameFallback?: (index: number) => string;
}

// Why a source isn't a usable document. The two need different responses:
// a parse error is usually temporary while the source is being typed (#433),
// and a missing container is a mistake in the document (#449).
export type DocumentProblem =
  | { reason: 'parse-error'; error: unknown }
  | { reason: 'container-not-found'; containerId: string };

export type DocumentInspection =
  { ok: true; doc: DocumentTree } | ({ ok: false } & DocumentProblem);

export const defaultSectionName = (index: number) => `Section ${index + 1}`;

export interface DocumentTree {
  code: string;
  ast: t.File;
  container: t.JSXElement;
}

const getAttr = (
  element: t.JSXElement,
  attrName: string,
): t.JSXAttribute | undefined =>
  element.openingElement.attributes.find(
    (a): a is t.JSXAttribute =>
      t.isJSXAttribute(a) &&
      t.isJSXIdentifier(a.name) &&
      a.name.name === attrName,
  );

const getAttrValue = (
  element: t.JSXElement,
  attrName: string,
): string | undefined => {
  const attr = getAttr(element, attrName);

  return attr && t.isStringLiteral(attr.value) ? attr.value.value : undefined;
};

const isSectionElement = (node: t.Node): node is t.JSXElement =>
  t.isJSXElement(node) && getJSXTagName(node.openingElement) === SECTION_TAG;

const findContainer = (
  ast: t.File,
  containerId: string,
): t.JSXElement | undefined => {
  let container: t.JSXElement | undefined;

  traverse(ast, {
    JSXElement(path) {
      if (getAttrValue(path.node, 'id') === containerId) {
        container = path.node;
        path.stop();
      }
    },
  });

  return container;
};

// Every outermost `<section>` under the container, at any depth. A
// `<section>` inside another one belongs to its parent, not to the list
// (#96).
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

// Caches each parse result, failures included, by container id and code:
// the same source can have a container under one id and not another. Many
// callers read the same document every render, so caching failures matters
// too while the source has a syntax error (#97).
const documentCache = createBoundedCache<string, DocumentInspection>(
  CONFIG.DOCUMENT_CACHE_LIMIT,
);

const buildDocument = (
  code: string,
  containerId: string,
): DocumentInspection => {
  let ast: t.File;

  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch (error) {
    console.warn('⚠️ Failed to parse document', error);

    return { ok: false, reason: 'parse-error', error };
  }

  const container = findContainer(ast, containerId);

  return container
    ? { ok: true, doc: { code, ast, container } }
    : { ok: false, reason: 'container-not-found', containerId };
};

// `parseDocument`, plus why it failed when it did. `Live.Dnd` uses the
// reason to tell the author what's wrong with the document.
export const inspectDocument = (
  code: string,
  { containerId = DEFAULT_CONTAINER_ID }: DocumentOptions = {},
): DocumentInspection => {
  const key = `${containerId}\0${code}`;
  const cached = documentCache.get(key);

  if (cached) {
    return cached;
  }

  const inspection = buildDocument(code, containerId);

  documentCache.set(key, inspection);

  return inspection;
};

// Parses the source into a cached `DocumentTree`, or `undefined` when it
// doesn't parse or has no container. Callers share the cached tree, so never
// mutate it: this module reads positions from it and edits the source text
// instead.
export const parseDocument = (
  code: string,
  options?: DocumentOptions,
): DocumentTree | undefined => {
  const inspection = inspectDocument(code, options);

  return inspection.ok ? inspection.doc : undefined;
};

export const clearDocumentParseCache = () => {
  documentCache.clear();
};

registerEditorCache(clearDocumentParseCache);

// The document's sections, in order. `id` is the section's `data-id`, or
// its position when it has none. A position isn't a stable identity, so run
// `fillSectionIds` first when the id has to survive an edit (#245).
//
// `name` is the section's `data-name`, or `sectionNameFallback(index)`:
// "Section 1", "Section 2", ... by default (#448).
export const getSections = (
  doc: DocumentTree,
  { sectionNameFallback = defaultSectionName }: SectionOptions = {},
): Section[] =>
  findOutermostSections(doc.container.children).map((node, index) => ({
    id: getAttrValue(node, DATA_ATTR.ID) || `${index}`,
    name: getAttrValue(node, DATA_NAME_ATTR) || sectionNameFallback(index),
    code: doc.code.slice(node.start!, node.end!),
  }));

// Gives every outermost `<section>` a `data-id` that is present and unique,
// so `getSections` returns a real identity (#245). A missing, empty or
// non-string id gets a new one, and so does a repeat of an earlier id: a
// section pasted twice in the code editor would otherwise let one delete
// remove both. Only the id attributes change; the rest of the source is
// kept as is.
//
// Derive from the result, and let it reach the document only with a real
// edit, so opening a document never rewrites it.
export const fillSectionIds = (
  code: string,
  generateId: () => string = () => nanoid(6),
  options?: DocumentOptions,
): string => {
  const doc = parseDocument(code, options);

  if (!doc) {
    return code;
  }

  const seen = new Set<string>();
  const edits: { start: number; end: number; text: string }[] = [];

  findOutermostSections(doc.container.children).forEach(node => {
    const attr = getAttr(node, DATA_ATTR.ID);
    const id =
      attr && t.isStringLiteral(attr.value) ? attr.value.value : undefined;

    if (id && !seen.has(id)) {
      seen.add(id);
      return;
    }

    const nextId = generateId();
    seen.add(nextId);

    // Replace the whole attribute when there is one, including a non-string
    // `data-id={x}`, so the element never ends up with two.
    edits.push(
      attr
        ? {
            start: attr.start!,
            end: attr.end!,
            text: `${DATA_ATTR.ID}="${nextId}"`,
          }
        : {
            start: node.openingElement.name.end!,
            end: node.openingElement.name.end!,
            text: ` ${DATA_ATTR.ID}="${nextId}"`,
          },
    );
  });

  if (!edits.length) {
    return code;
  }

  // Ids are drawn in document order, but applied right-to-left so each edit
  // leaves the offsets of the ones before it untouched.
  return edits.reduceRight(
    (acc, edit) =>
      `${acc.slice(0, edit.start)}${edit.text}${acc.slice(edit.end)}`,
    code,
  );
};

// The source span of `container`'s children: from just after the opening
// tag's `>` to just before the closing tag's `<`. `undefined` for a
// self-closing container.
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

// Replaces the container's sections with `sectionCodes`. The old and new
// lists are compared by their common prefix and suffix, and only the source
// between them is replaced, so unchanged sections and the markup around
// them (such as wrapper elements) stay as they are (#102). Calls that make
// one change at a time, as `Live.Dnd` does, are exact. Swapping two sections
// replaces everything between them, markup included.
//
// `sectionCodes` are inserted as text without checks: an invalid section
// shows up as a compile error instead of disappearing (#96).
export const replaceDocumentSections = (
  fullCode: string,
  sectionCodes: string[],
  options?: DocumentOptions,
): string => {
  const doc = parseDocument(fullCode, options);

  if (!doc) {
    return fullCode;
  }

  const sections = findOutermostSections(doc.container.children);

  if (sections.length === 0) {
    // No sections yet: append after whatever the container holds, keeping
    // it.
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
    // Nothing removed: either no change, or an insertion placed before the
    // next unchanged section (or after the last one).
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

// The document with only `sectionCode` in the container, for compiling one
// section on its own. Not an edit: everything else in the container is
// dropped.
export const generateSectionPreview = (
  fullCode: string,
  sectionCode: string,
  options?: DocumentOptions,
): string => generateSectionPreviews(fullCode, [sectionCode], options)[0]!;

// `generateSectionPreview` for every section, parsing `fullCode` once
// (#97). A section that didn't change gets the same string as before, so
// `React.memo` can skip it.
export const generateSectionPreviews = (
  fullCode: string,
  sectionCodes: string[],
  options?: DocumentOptions,
): string[] => {
  const doc = parseDocument(fullCode, options);
  const span = doc && getContainerInnerSpan(doc.container);

  if (!span) {
    return sectionCodes.map(() => fullCode);
  }

  return sectionCodes.map(sectionCode =>
    spliceCode(fullCode, span.start, span.end, sectionCode),
  );
};

export interface SectionPreviewCache {
  // Previews for `sections`, reusing the last call's preview of any section
  // whose code didn't change. Call it once per render with every section.
  // Sections are matched by `id`, which must be stable.
  compute: (
    fullCode: string,
    sections: { id: string; code: string }[],
    options?: DocumentOptions,
  ) => string[];
}

// `generateSectionPreviews` that remembers its last result and reuses the
// previews of unchanged sections instead of building them again (#131).
// The saving is small: re-parsing the edited document costs far more, and
// happens on every edit regardless (`document.bench.ts`).
//
// Create one per editor and keep it for the editor's lifetime, as
// `useSectionDocument` does.
export const createSectionPreviewCache = (): SectionPreviewCache => {
  let containerPrefix: string | null = null;
  let containerSuffix: string | null = null;
  let previewsById = new Map<string, { code: string; preview: string }>();

  const compute = (
    fullCode: string,
    sections: { id: string; code: string }[],
    options?: DocumentOptions,
  ): string[] => {
    const doc = parseDocument(fullCode, options);
    const span = doc && getContainerInnerSpan(doc.container);

    if (!span) {
      containerPrefix = null;
      containerSuffix = null;
      previewsById = new Map();
      return sections.map(() => fullCode);
    }

    // When the source around the container's children is the same as last
    // time, an unchanged section's preview is the same too, wherever the
    // span now starts.
    const prefix = fullCode.slice(0, span.start);
    const suffix = fullCode.slice(span.end);
    const containerUnchanged =
      prefix === containerPrefix && suffix === containerSuffix;

    const nextPreviewsById = new Map<
      string,
      { code: string; preview: string }
    >();

    const previews = sections.map(section => {
      const cached = containerUnchanged
        ? previewsById.get(section.id)
        : undefined;

      if (cached && cached.code === section.code) {
        nextPreviewsById.set(section.id, cached);
        return cached.preview;
      }

      // Filled the same way the panel fills the selected section, so an
      // element's `data-id` in the preview matches its fields (#432).
      const preview = spliceCode(
        fullCode,
        span.start,
        span.end,
        fillIdsFrom(section.code, section.id),
      );
      nextPreviewsById.set(section.id, { code: section.code, preview });
      return preview;
    });

    containerPrefix = prefix;
    containerSuffix = suffix;
    previewsById = nextPreviewsById;

    return previews;
  };

  return { compute };
};
