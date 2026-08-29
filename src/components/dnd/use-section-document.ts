import { useCallback, useMemo, useState } from 'react';

import { arrayMove } from '@dnd-kit/sortable';

import type { Section } from '~/types';
import {
  createSectionPreviewCache,
  extractSections,
  replaceSections,
} from '~/utils';
import { fillSectionIds, replaceIds } from '~/utils/ast';

import { usePreview } from '../context/states';

export interface SectionDocument {
  sections: Section[];
  previews: string[];
  selectedId: string | null;
  selectedItem?: Section;
  selectedIndex: number;
  select: (id: string) => void;
  clearSelection: () => void;
  add: (item: Pick<Section, 'name' | 'code'>, atIndex?: number) => void;
  remove: (id: string) => void;
  copy: (id: string) => void;
  move: (id: string | null, direction: 'up' | 'down') => void;
  reorder: (activeId: string, overId: string) => void;
  patch: (next: Partial<Section> & { id: string }) => void;
}

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
): SectionDocument => {
  const { setCode } = usePreview();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sections identify themselves by `data-id`; `getSections` falls back to a
  // positional id for documents predating that (see #245). Filling the gap
  // here makes the ids below real identities rather than positions, so a
  // held `selectedId` survives an insert, copy, move or delete.
  //
  // Deliberately not committed on its own — like dnd.tsx's existing use of
  // fillIds for field ids, the filled document only reaches
  // `onChange`/`setCode` when a real mutation commits, so merely opening a
  // document never rewrites the author's code.
  const document = useMemo(() => fillSectionIds(value), [value]);
  const sections = useMemo(() => extractSections(document), [document]);

  // One cache per hook instance (lazy `useState` initializer, never
  // replaced) — see createSectionPreviewCache (#131). It's stateful by
  // design (remembers the previous render's previews to reuse the ones that
  // didn't change), which a `useMemo`/`useRef` can't do without touching a
  // ref during render; a cache object stored via `useState` and only ever
  // mutated through its own method isn't subject to that restriction the way
  // `ref.current` is.
  const [previewCache] = useState(() => createSectionPreviewCache());
  const previews = useMemo(
    () => previewCache.compute(document, sections),
    [previewCache, sections, document],
  );

  const selectedIndex = sections.findIndex(s => s.id === selectedId);
  const selectedItem = selectedIndex >= 0 ? sections[selectedIndex] : undefined;

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
          document,
          nextSections.map(s => s.code),
        ),
      );

      onChange?.(nextCode);
      setCode(nextCode);

      return extractSections(nextCode);
    },
    [document, onChange, setCode],
  );

  const select = useCallback((id: string) => {
    setSelectedId(prev => (prev === id ? null : id));
  }, []);

  const clearSelection = useCallback(() => setSelectedId(null), []);

  const add = useCallback(
    (item: Pick<Section, 'name' | 'code'>, atIndex?: number) => {
      const next = { code: item.code };

      commit(
        atIndex === undefined || atIndex < 0
          ? [...sections, next]
          : [...sections.slice(0, atIndex), next, ...sections.slice(atIndex)],
      );
    },
    [commit, sections],
  );

  const remove = useCallback(
    (id: string) => {
      // Removes by position, not by predicate: `fillSectionIds` keeps ids
      // unique, but a filter would delete every match if that invariant ever
      // slipped — and this is the one destructive operation here, so it
      // shouldn't be the one relying on it.
      const index = sections.findIndex(s => s.id === id);

      if (index < 0) {
        return;
      }

      // Only the deleted section loses the selection. The previous
      // implementation cleared it unconditionally, so deleting any section
      // closed the panel for whichever one was open.
      if (id === selectedId) {
        setSelectedId(null);
      }

      commit(sections.filter((_, i) => i !== index));
    },
    [commit, sections, selectedId],
  );

  const copy = useCallback(
    (id: string) => {
      const index = sections.findIndex(s => s.id === id);
      const source = sections[index];

      if (!source) {
        return;
      }

      // replaceIds refreshes every data-id in the snippet, the section's own
      // included, so the copy carries a distinct identity into the document.
      const committed = commit([
        ...sections.slice(0, index + 1),
        { code: replaceIds(source.code) },
        ...sections.slice(index + 1),
      ]);

      // Read the new id back from the committed document. This used to
      // select a `uuidv4()` that was never written into the code and so
      // didn't exist after the next parse, leaving the panel empty right
      // after a copy (#245).
      setSelectedId(committed[index + 1]?.id ?? null);
    },
    [commit, sections],
  );

  const move = useCallback(
    (id: string | null, direction: 'up' | 'down') => {
      const index = sections.findIndex(s => s.id === id);
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (index < 0 || targetIndex < 0 || targetIndex >= sections.length) {
        return;
      }

      // No `setSelectedId` compensation needed any more: the id travels with
      // the section's own markup, so the selection follows it across a move.
      commit(arrayMove(sections, index, targetIndex));
    },
    [commit, sections],
  );

  const reorder = useCallback(
    (activeId: string, overId: string) => {
      const prevIndex = sections.findIndex(s => s.id === activeId);
      const nextIndex = sections.findIndex(s => s.id === overId);

      if (prevIndex < 0 || nextIndex < 0 || prevIndex === nextIndex) {
        return;
      }

      commit(arrayMove(sections, prevIndex, nextIndex));
    },
    [commit, sections],
  );

  const patch = useCallback(
    (next: Partial<Section> & { id: string }) => {
      commit(sections.map(s => (s.id === next.id ? { ...s, ...next } : s)));
    },
    [commit, sections],
  );

  return {
    sections,
    previews,
    selectedId,
    selectedItem,
    selectedIndex,
    select,
    clearSelection,
    add,
    remove,
    copy,
    move,
    reorder,
    patch,
  };
};
