import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { arrayMove } from '@dnd-kit/sortable';

import type { Section } from '~/types';
import {
  type DocumentProblem,
  type SectionOptions,
  fillSectionIds,
  inspectDocument,
  replaceIds,
} from '~/utils/ast';
import {
  createSectionPreviewCache,
  extractSections,
  replaceSections,
} from '~/utils/sections';

import { usePreview } from '../context/states';

export interface SectionDocument {
  sections: Section[];
  previews: string[];
  selectedId: string | null;
  selectedItem?: Section;
  selectedIndex: number;
  select: (id: string) => void;
  // Selects `id` outright, where `select` toggles. For keyboard navigation,
  // which lands on a section and must not deselect it (#435).
  selectOnly: (id: string) => void;
  clearSelection: () => void;
  add: (item: Pick<Section, 'name' | 'code'>, atIndex?: number) => void;
  remove: (id: string) => void;
  copy: (id: string) => void;
  move: (id: string | null, direction: 'up' | 'down') => void;
  reorder: (activeId: string, overId: string) => void;
  patch: (next: Partial<Section> & { id: string }) => void;
  // The section as the latest commit left it, when a commit has landed since
  // this render; `undefined` when nothing has, or when that commit removed
  // it. Lets a caller that edits inside a section build on a same-tick
  // commit instead of this render's `sections` (#450).
  getCommittedSection: (id: string) => Section | undefined;
  // Why `value` isn't a usable document, or `null` when it is (#433, #449).
  problem: DocumentProblem | null;
  // True while `value` doesn't parse and `sections`/`previews` are the last
  // ones that did. Every mutation is refused then, through `onBlockedEdit`:
  // the only ranges to edit are from a different source (#433).
  stale: boolean;
}

export interface SectionDocumentOptions extends SectionOptions {
  // Called instead of committing when a mutation is refused because the
  // document doesn't parse. Pass a stable function.
  onBlockedEdit?: (problem: DocumentProblem) => void;
}

// The last document that parsed, per container id. A box held in `useState`
// and written from the derivation below, like `createSectionPreviewCache`:
// it only remembers a value, it never decides what renders on its own.
const createLastParsed = () => {
  let last: { containerId?: string; document: string } | null = null;

  return {
    read: (containerId?: string) =>
      last && last.containerId === containerId ? last.document : undefined,
    write: (containerId: string | undefined, document: string) => {
      last = { containerId, document };
    },
  };
};

// Owns the document side of the DnD canvas: deriving sections from the code
// string, tracking which one is selected, and committing every mutation.
//
// Extracted from Dnd (#245), where the commit sequence
// `replaceSections -> onChange -> setCode` was spelled out seven separate
// times. Naming it once means no mutation can perform half of it, and it
// puts the section logic somewhere reachable without rendering dnd-kit.
export const useSectionDocument = (
  value: string,
  onChange?: (value: string) => void,
  {
    containerId,
    sectionNameFallback,
    onBlockedEdit,
  }: SectionDocumentOptions = {},
): SectionDocument => {
  const { setCode } = usePreview();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Every read of a document into sections goes through here, so a section
  // without `data-name` is named the same way wherever it's read (#448).
  const readSections = useCallback(
    (code: string) =>
      extractSections(code, { containerId, sectionNameFallback }),
    [containerId, sectionNameFallback],
  );

  // Sections identify themselves by `data-id`; `getSections` falls back to a
  // positional id for documents predating that (see #245). Filling the gap
  // here makes the ids below real identities rather than positions, so a
  // held `selectedId` survives an insert, copy, move or delete.
  //
  // Deliberately not committed on its own — like dnd.tsx's existing use of
  // fillIds for field ids, the filled document only reaches
  // `onChange`/`setCode` when a real mutation commits, so merely opening a
  // document never rewrites the author's code.
  const document = useMemo(
    () => fillSectionIds(value, undefined, { containerId }),
    [containerId, value],
  );

  // What the canvas and panel show. Normally `document` itself. While the
  // source doesn't parse, which is usually the moment an author is typing in
  // the code editor, it's the last version that did, so the canvas and panel
  // keep their content instead of emptying on every keystroke (#433). A
  // missing container isn't covered: that isn't a passing state, and the
  // canvas says what's wrong instead (#449).
  //
  // Not a regex scan of the broken source: section ranges are where every
  // commit writes back, and a guessed range could put an edit in the wrong
  // place. The last parsed version is shown read-only instead.
  const [lastParsed] = useState(createLastParsed);
  const view = useMemo(() => {
    const inspection = inspectDocument(document, { containerId });

    if (inspection.ok) {
      lastParsed.write(containerId, document);

      return { document, problem: null, stale: false };
    }

    const { ok: _ok, ...problem } = inspection;
    const last =
      problem.reason === 'parse-error'
        ? lastParsed.read(containerId)
        : undefined;

    return { document: last ?? document, problem, stale: last !== undefined };
  }, [containerId, document, lastParsed]);

  const sections = useMemo(
    () => readSections(view.document),
    [readSections, view.document],
  );

  // One cache per hook instance (lazy `useState` initializer, never
  // replaced) — see createSectionPreviewCache (#131). It's stateful by
  // design (remembers the previous render's previews to reuse the ones that
  // didn't change), which a `useMemo`/`useRef` can't do without touching a
  // ref during render; a cache object stored via `useState` and only ever
  // mutated through its own method isn't subject to that restriction the way
  // `ref.current` is.
  const [previewCache] = useState(() => createSectionPreviewCache());
  const previews = useMemo(
    () => previewCache.compute(view.document, sections, { containerId }),
    [containerId, previewCache, sections, view.document],
  );

  const selectedIndex = sections.findIndex(s => s.id === selectedId);
  const selectedItem = selectedIndex >= 0 ? sections[selectedIndex] : undefined;

  // The document the last commit produced, tagged with the render document
  // it was built on. A commit's own `document`/`sections` are this render's
  // snapshot, and the host only hands the new value back on the next render,
  // so two commits in the same tick both started from the snapshot and the
  // second wrote the first one's section back as it was (#450). Every
  // mutation below reads through `latestDocument()` instead.
  //
  // Dropped after each render: from then on the render's own `value` is the
  // source of truth, including when the host chose not to accept a commit.
  // The `from` check covers the window between that render and this effect.
  const pendingRef = useRef<{ from: string; code: string } | null>(null);

  useEffect(() => {
    pendingRef.current = null;
  });

  const latestDocument = useCallback(() => {
    const pending = pendingRef.current;

    return pending?.from === document ? pending.code : document;
  }, [document]);

  // `extractSections` goes through the document parse cache, so re-reading
  // an unchanged document here costs a cache hit, not a parse.
  const latestSections = useCallback(
    () => readSections(latestDocument()),
    [latestDocument, readSections],
  );

  // The single place a set of sections becomes a new document. Takes only
  // `code` because that is genuinely all a commit reads — ids and names are
  // re-derived from the result, never carried across.
  //
  // Runs `fillSectionIds` on the way out so a section that arrived without
  // one still lands with an id: a palette template is a bare `<section>`
  // snippet with no `#app-container`, so it cannot be filled until after
  // it's spliced in. Returns the resulting sections so a caller that needs
  // to select what it just created can read the real id back rather than
  // inventing one.
  const commit = useCallback(
    (nextSections: { code: string }[]): Section[] => {
      const nextCode = fillSectionIds(
        replaceSections(
          latestDocument(),
          nextSections.map(s => s.code),
          { containerId },
        ),
        undefined,
        { containerId },
      );

      pendingRef.current = { from: document, code: nextCode };
      onChange?.(nextCode);
      setCode(nextCode);

      return readSections(nextCode);
    },
    [containerId, document, latestDocument, onChange, readSections, setCode],
  );

  const getCommittedSection = useCallback(
    (id: string) => {
      const pending = pendingRef.current;

      if (pending?.from !== document) {
        return undefined;
      }

      return readSections(pending.code).find(s => s.id === id);
    },
    [document, readSections],
  );

  // Every mutation starts here. Refusing up front, rather than letting the
  // edit reach `replaceSections`, matters: on a source that doesn't parse
  // that returns the source unchanged, so the edit used to "commit" nothing
  // and say nothing.
  const { problem, stale } = view;
  const refuse = useCallback(() => {
    if (!stale || !problem) {
      return false;
    }

    onBlockedEdit?.(problem);

    return true;
  }, [onBlockedEdit, problem, stale]);

  const select = useCallback((id: string) => {
    setSelectedId(prev => (prev === id ? null : id));
  }, []);

  const selectOnly = useCallback((id: string) => setSelectedId(id), []);

  const clearSelection = useCallback(() => setSelectedId(null), []);

  const add = useCallback(
    (item: Pick<Section, 'name' | 'code'>, atIndex?: number) => {
      if (refuse()) {
        return;
      }

      const current = latestSections();
      const next = { code: item.code };

      commit(
        atIndex === undefined || atIndex < 0
          ? [...current, next]
          : [...current.slice(0, atIndex), next, ...current.slice(atIndex)],
      );
    },
    [commit, refuse, latestSections],
  );

  const remove = useCallback(
    (id: string) => {
      if (refuse()) {
        return;
      }

      const current = latestSections();

      // Removes by position, not by predicate: `fillSectionIds` keeps ids
      // unique, but a filter would delete every match if that invariant ever
      // slipped — and this is the one destructive operation here, so it
      // shouldn't be the one relying on it.
      const index = current.findIndex(s => s.id === id);

      if (index < 0) {
        return;
      }

      // Only the deleted section loses the selection. The previous
      // implementation cleared it unconditionally, so deleting any section
      // closed the panel for whichever one was open.
      if (id === selectedId) {
        setSelectedId(null);
      }

      commit(current.filter((_, i) => i !== index));
    },
    [commit, refuse, latestSections, selectedId],
  );

  const copy = useCallback(
    (id: string) => {
      if (refuse()) {
        return;
      }

      const current = latestSections();

      const index = current.findIndex(s => s.id === id);
      const source = current[index];

      if (!source) {
        return;
      }

      // replaceIds refreshes every data-id in the snippet, the section's own
      // included, so the copy carries a distinct identity into the document.
      const committed = commit([
        ...current.slice(0, index + 1),
        { code: replaceIds(source.code) },
        ...current.slice(index + 1),
      ]);

      // Read the new id back from the committed document. This used to
      // select a `uuidv4()` that was never written into the code and so
      // didn't exist after the next parse, leaving the panel empty right
      // after a copy (#245).
      setSelectedId(committed[index + 1]?.id ?? null);
    },
    [commit, refuse, latestSections],
  );

  const move = useCallback(
    (id: string | null, direction: 'up' | 'down') => {
      if (refuse()) {
        return;
      }

      const current = latestSections();

      const index = current.findIndex(s => s.id === id);
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return;
      }

      // No `setSelectedId` compensation needed any more: the id travels with
      // the section's own markup, so the selection follows it across a move.
      commit(arrayMove(current, index, targetIndex));
    },
    [commit, refuse, latestSections],
  );

  const reorder = useCallback(
    (activeId: string, overId: string) => {
      if (refuse()) {
        return;
      }

      const current = latestSections();

      const prevIndex = current.findIndex(s => s.id === activeId);
      const nextIndex = current.findIndex(s => s.id === overId);

      if (prevIndex < 0 || nextIndex < 0 || prevIndex === nextIndex) {
        return;
      }

      commit(arrayMove(current, prevIndex, nextIndex));
    },
    [commit, refuse, latestSections],
  );

  const patch = useCallback(
    (next: Partial<Section> & { id: string }) => {
      if (refuse()) {
        return;
      }

      const current = latestSections();

      commit(current.map(s => (s.id === next.id ? { ...s, ...next } : s)));
    },
    [commit, refuse, latestSections],
  );

  return {
    sections,
    previews,
    selectedId,
    selectedItem,
    selectedIndex,
    select,
    selectOnly,
    clearSelection,
    add,
    remove,
    copy,
    move,
    reorder,
    patch,
    getCommittedSection,
    problem,
    stale,
  };
};
