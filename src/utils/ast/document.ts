import { parse, parseExpression } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { TraverseOptions, Visitor } from '@babel/traverse';
import * as t from '@babel/types';
import { nanoid } from 'nanoid';

import { CONFIG, DATA_ATTR, DEFAULT_CONTAINER_ID } from '../../constants';
import type { Section } from '../../types';
import { createBoundedCache } from '../cache';
import { registerEditorCache } from '../editor-caches';
import { getJSXTagName } from './jsx-name';
import { type SourceEdit, applyEdits } from './patch';
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

type DocumentInspection =
  { ok: true; doc: DocumentTree } | ({ ok: false } & DocumentProblem);

const defaultSectionName = (index: number) => `Section ${index + 1}`;

interface DocumentTree {
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

// How new sections are laid out next to `neighbor`: its indentation and the
// document's line ending. `null` when the neighbor shares its line with other
// code, where a line break would move that code, so the caller keeps its
// default.
const layoutNextTo = (
  code: string,
  neighbor: t.JSXElement,
): { eol: string; indent: string } | null => {
  const lineStart = code.lastIndexOf('\n', neighbor.start! - 1) + 1;
  const indent = code.slice(lineStart, neighbor.start!);

  if (!/^[ \t]*$/.test(indent)) {
    return null;
  }

  return { eol: code.includes('\r\n') ? '\r\n' : '\n', indent };
};

// New sections written on their own lines in the layout of `neighbor`.
// `before` puts them ahead of it, so it keeps the indentation already in
// front of it. The sections lose their leading and trailing whitespace, and
// in a CRLF document their own line breaks use CRLF too.
const sectionsNextTo = (
  code: string,
  neighbor: t.JSXElement,
  newCodes: string[],
  position: 'before' | 'after',
): string => {
  const layout = layoutNextTo(code, neighbor);

  if (!layout) {
    return position === 'before'
      ? `${newCodes.join('\n')}\n`
      : `\n${newCodes.join('\n')}`;
  }

  const { eol, indent } = layout;
  // The surrounding whitespace of a template literal, such as a palette
  // section, goes: the section starts right after the indentation.
  const lines = newCodes.map(newCode =>
    eol === '\r\n' ? newCode.trim().replace(/\r?\n/g, eol) : newCode.trim(),
  );

  return position === 'before'
    ? lines.map(line => `${line}${eol}${indent}`).join('')
    : lines.map(line => `${eol}${indent}${line}`).join('');
};

// A section's `data-id` as a non-empty string literal, as `fillSectionIds`
// counts one, or `undefined`.
const sectionIdOfNode = (node: t.JSXElement): string | undefined =>
  getAttrValue(node, DATA_ATTR.ID) || undefined;

// The same for a section's code. `undefined` when it doesn't parse either.
const sectionIdOf = (code: string): string | undefined => {
  try {
    const node = parseExpression(code, { plugins: ['jsx', 'typescript'] });

    return t.isJSXElement(node) ? sectionIdOfNode(node) : undefined;
  } catch {
    return undefined;
  }
};

// The positions of the longest strictly increasing run in `values`, leaving
// out the position `skip`. Of several equally long runs it picks the one with
// the smallest values.
const longestIncreasingRun = (values: number[], skip = -1): number[] => {
  // `lengthFrom[k]`: the length of the longest run that starts at `k`.
  const lengthFrom = values.map(() => 0);

  for (let k = values.length - 1; k >= 0; k--) {
    if (k === skip) {
      continue;
    }

    let longest = 0;

    for (let m = k + 1; m < values.length; m++) {
      if (values[m]! > values[k]! && lengthFrom[m]! > longest) {
        longest = lengthFrom[m]!;
      }
    }

    lengthFrom[k] = longest + 1;
  }

  const run: number[] = [];
  let remaining = Math.max(0, ...lengthFrom);
  let last = -1;

  while (remaining > 0) {
    let pick = -1;

    for (let k = last + 1; k < values.length; k++) {
      if (
        lengthFrom[k] === remaining &&
        (last < 0 || values[k]! > values[last]!) &&
        (pick < 0 || values[k]! < values[pick]!)
      ) {
        pick = k;
      }
    }

    run.push(pick);
    last = pick;
    remaining--;
  }

  return run;
};

// The edit that removes `node`: its whole line when nothing else is on it, so
// no blank line is left behind, or else only its span.
const removalOf = (code: string, node: t.JSXElement): SourceEdit => {
  const lineStart = code.lastIndexOf('\n', node.start! - 1) + 1;
  const lineEnd = code.indexOf('\n', node.end!);

  if (
    lineEnd >= 0 &&
    /^[ \t]*$/.test(code.slice(lineStart, node.start!)) &&
    /^[ \t]*\r?$/.test(code.slice(node.end!, lineEnd))
  ) {
    return { start: lineStart, end: lineEnd + 1, content: '' };
  }

  return { start: node.start!, end: node.end!, content: '' };
};

// The edits for the changed window when its sections can be matched by
// `data-id`, or `null` when they can't: an old section without an id, an id
// used twice, or no new section matching an old one.
//
// The longest run of matched sections still in their old order stays in
// place; the others are removed and written again next to the section before
// them in the new list, so a move takes only the moved section across the
// markup around it, such as a wrapper (#794). A tie, as in a swap of two
// neighbors, moves `movedId` when it's one of them, and the later section
// otherwise.
const reorderEdits = (
  fullCode: string,
  sections: t.JSXElement[],
  windowStart: number,
  windowEnd: number,
  newCodes: string[],
  movedId: string | undefined,
): SourceEdit[] | null => {
  const oldIndexById = new Map<string, number>();
  const idByCode = new Map<string, string>();

  for (let i = windowStart; i < windowEnd; i++) {
    const node = sections[i]!;
    const id = sectionIdOfNode(node);

    if (id === undefined || oldIndexById.has(id)) {
      return null;
    }

    oldIndexById.set(id, i);
    idByCode.set(fullCode.slice(node.start!, node.end!), id);
  }

  const newIds = newCodes.map(code => idByCode.get(code) ?? sectionIdOf(code));
  const definedIds = newIds.filter(id => id !== undefined);

  if (new Set(definedIds).size !== definedIds.length) {
    return null;
  }

  // The new positions of the sections that are in both lists, in new order.
  const matched = newIds.flatMap((id, newIndex) => {
    const oldIndex = id === undefined ? undefined : oldIndexById.get(id);

    return oldIndex === undefined ? [] : [{ newIndex, oldIndex }];
  });

  if (matched.length === 0) {
    return null;
  }

  const oldOrder = matched.map(m => m.oldIndex);
  let run = longestIncreasingRun(oldOrder);
  const movedAt = movedId === undefined ? -1 : newIds.indexOf(movedId);
  const skip = matched.findIndex(m => m.newIndex === movedAt);

  if (skip >= 0) {
    const withoutMoved = longestIncreasingRun(oldOrder, skip);

    if (withoutMoved.length === run.length) {
      run = withoutMoved;
    }
  }

  // New index → the old section that keeps its place for it.
  const kept = new Map(
    run.map(k => [matched[k]!.newIndex, matched[k]!.oldIndex]),
  );
  const keptOld = new Set(kept.values());
  const edits: SourceEdit[] = [];

  for (let i = windowStart; i < windowEnd; i++) {
    if (!keptOld.has(i)) {
      edits.push(removalOf(fullCode, sections[i]!));
    }
  }

  let anchor = windowStart > 0 ? sections[windowStart - 1] : undefined;
  let pending: string[] = [];

  const flushBefore = (next: t.JSXElement | undefined) => {
    if (pending.length === 0) {
      return;
    }

    if (anchor) {
      edits.push({
        start: anchor.end!,
        end: anchor.end!,
        content: sectionsNextTo(fullCode, anchor, pending, 'after'),
      });
    } else if (next) {
      edits.push({
        start: next.start!,
        end: next.start!,
        content: sectionsNextTo(fullCode, next, pending, 'before'),
      });
    }

    pending = [];
  };

  newCodes.forEach((code, newIndex) => {
    const oldIndex = kept.get(newIndex);

    if (oldIndex === undefined) {
      pending.push(code);

      return;
    }

    const node = sections[oldIndex]!;

    flushBefore(node);

    if (fullCode.slice(node.start!, node.end!) !== code) {
      edits.push({ start: node.start!, end: node.end!, content: code });
    }

    anchor = node;
  });

  flushBefore(sections[windowEnd]);

  return edits;
};

interface ReplaceSectionsOptions extends DocumentOptions {
  // The id of the section a move started from, for a reorder where more than
  // one section could have moved.
  movedId?: string;
}

// Replaces the container's sections with `sectionCodes`. The old and new
// lists are compared by their common prefix and suffix, and only the sections
// between them change, so unchanged sections and the markup around them (such
// as wrapper elements) stay as they are (#102). The comments, other elements
// and wrappers between sections stay where they are too (#598).
//
// Within that window, sections with a `data-id` are matched by it, and only
// the ones whose order changed move (`reorderEdits`). Without ids, each old
// section takes the new code at its position.
//
// `sectionCodes` are inserted as text without checks: an invalid section
// shows up as a compile error instead of disappearing (#96).
export const replaceDocumentSections = (
  fullCode: string,
  sectionCodes: string[],
  { movedId, ...options }: ReplaceSectionsOptions = {},
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
      const next = sections[oldChangedStart]!;

      return spliceCode(
        fullCode,
        next.start!,
        next.start!,
        sectionsNextTo(fullCode, next, newChanged, 'before'),
      );
    }

    const last = sections[sections.length - 1]!;

    return spliceCode(
      fullCode,
      last.end!,
      last.end!,
      sectionsNextTo(fullCode, last, newChanged, 'after'),
    );
  }

  const byId = reorderEdits(
    fullCode,
    sections,
    oldChangedStart,
    oldChangedEndExclusive,
    newChanged,
    movedId,
  );

  if (byId) {
    return applyEdits(fullCode, byId);
  }

  // Each old section in the window takes the new code at its position. A
  // longer new list adds the rest after the last of them, and a shorter one
  // removes the old sections left over, each by its own span.
  const window = sections.slice(oldChangedStart, oldChangedEndExclusive);
  const paired = Math.min(window.length, newChanged.length);
  const edits: SourceEdit[] = [];

  window.forEach((node, index) => {
    if (index < paired) {
      if (oldCodes[oldChangedStart + index] !== newChanged[index]) {
        edits.push({
          start: node.start!,
          end: node.end!,
          content: newChanged[index]!,
        });
      }
    } else {
      edits.push({ start: node.start!, end: node.end!, content: '' });
    }
  });

  if (newChanged.length > paired) {
    const anchor = window[paired - 1]!;

    edits.push({
      start: anchor.end!,
      end: anchor.end!,
      content: sectionsNextTo(
        fullCode,
        anchor,
        newChanged.slice(paired),
        'after',
      ),
    });
  }

  return applyEdits(fullCode, edits);
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

interface SectionPreviewCache {
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
