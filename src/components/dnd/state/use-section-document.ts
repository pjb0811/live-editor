import { useCallback, useMemo, useState } from 'react';

import { arrayMove } from '@dnd-kit/sortable';
import { usePendingCommit } from '@jbpark/use-hooks';

import type { Section } from '~/types';
import {
  type DocumentProblem,
  type SectionOptions,
} from '~/utils/ast/document';
import { fillSectionIds, inspectDocument } from '~/utils/ast/document';
import { replaceIds } from '~/utils/ast/tree';
import {
  createSectionPreviewCache,
  extractSections,
  replaceSections,
} from '~/utils/sections';

import { usePreview } from '../../context/states';

interface SectionDocument {
  sections: Section[];
  previews: string[];
  selectedId: string | null;
  selectedSection?: Section;
  selectedIndex: number;
  select: (id: string) => void;
  // Selects `id` without toggling, unlike `select`. Keyboard navigation uses
  // it, since landing on a section must not deselect it (#435).
  selectOnly: (id: string) => void;
  clearSelection: () => void;
  add: (section: Pick<Section, 'name' | 'code'>, atIndex?: number) => void;
  remove: (id: string) => void;
  copy: (id: string) => void;
  move: (id: string | null, direction: 'up' | 'down') => void;
  reorder: (activeId: string, overId: string) => void;
  patch: (next: Partial<Section> & { id: string }) => void;
  // The section as the latest commit left it, or `undefined` when nothing
  // has been committed since this render (or that commit removed it). Lets
  // an edit inside a section build on a commit from the same tick (#450).
  getCommittedSection: (id: string) => Section | undefined;
  // Why `value` isn't a usable document, or `null` when it is (#433, #449).
  problem: DocumentProblem | null;
  // True while `value` doesn't parse and `sections`/`previews` are from the
  // last version that did. Every mutation is then refused through
  // `onBlockedEdit`, because their source ranges belong to that version
  // (#433).
  stale: boolean;
}

interface SectionDocumentOptions extends SectionOptions {
  // Called instead of committing when a mutation is refused because the
  // document doesn't parse. Pass a stable function.
  onBlockedEdit?: (problem: DocumentProblem) => void;
}

// Remembers the last document that parsed, per container id. Kept in
// `useState` and written from the derivation below; it never decides what
// renders by itself.
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

// The document side of `Live.Dnd`: reads the sections out of the code,
// tracks the selected one, and commits every section operation through one
// `commit` (#245).
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

  // Every read of sections goes through here, so a section without
  // `data-name` gets the same name everywhere (#448).
  const readSections = useCallback(
    (code: string) =>
      extractSections(code, { containerId, sectionNameFallback }),
    [containerId, sectionNameFallback],
  );

  // Gives every section a unique `data-id`, so `selectedId` follows its
  // section through an insert, copy, move or delete (#245). The filled ids
  // reach the source only with the next commit: opening a document never
  // rewrites it.
  const document = useMemo(
    () => fillSectionIds(value, undefined, { containerId }),
    [containerId, value],
  );

  // What the canvas and panel show: `document`, or while it doesn't parse,
  // the last version that did, read-only (#433). This keeps them from
  // emptying on every keystroke in the code editor. A missing container shows
  // the problem instead (#449).
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

  // One preview cache per hook instance, which reuses the previews of
  // sections that didn't change (#131). Held in `useState` because it keeps
  // state between renders, which `useMemo` can't.
  const [previewCache] = useState(() => createSectionPreviewCache());
  const previews = useMemo(
    () => previewCache.compute(view.document, sections, { containerId }),
    [containerId, previewCache, sections, view.document],
  );

  const selectedIndex = sections.findIndex(s => s.id === selectedId);
  const selectedSection =
    selectedIndex >= 0 ? sections[selectedIndex] : undefined;

  // The document the last commit produced, read only while `document` is
  // still the one it was built on. Mutations read through
  // `latestDocument()`, so a second commit in the same tick builds on the
  // first instead of undoing it (#450). The hook drops it after each render,
  // when the new `value` takes over, including when the host didn't accept
  // the commit.
  const pending = usePendingCommit<string, string>(document);

  const latestDocument = useCallback(
    () => pending.read() ?? document,
    [document, pending],
  );

  // Re-reading an unchanged document is a parse-cache hit, not a new parse.
  const latestSections = useCallback(
    () => readSections(latestDocument()),
    [latestDocument, readSections],
  );

  // The one place a list of sections becomes a new document, sent to the
  // host's `onChange` and the provider. Ids and names are read again from the
  // result, so only `code` is taken. `fillSectionIds` gives an id to a
  // section added without one, such as a palette template. Returns the new
  // sections so a caller can select one by its real id.
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

      pending.write(nextCode);
      onChange?.(nextCode);
      setCode(nextCode);

      return readSections(nextCode);
    },
    [containerId, latestDocument, onChange, pending, readSections, setCode],
  );

  const getCommittedSection = useCallback(
    (id: string) => {
      const code = pending.read();

      return code === undefined
        ? undefined
        : readSections(code).find(s => s.id === id);
    },
    [pending, readSections],
  );

  // True, after reporting through `onBlockedEdit`, while the document is
  // stale.
  const { problem, stale } = view;
  const refuse = useCallback(() => {
    if (!stale || !problem) {
      return false;
    }

    onBlockedEdit?.(problem);

    return true;
  }, [onBlockedEdit, problem, stale]);

  // Every mutation starts here. It runs on the latest sections, or not at
  // all while the document is stale.
  const mutate = useCallback(
    (fn: (current: Section[]) => void) => {
      if (refuse()) {
        return;
      }

      fn(latestSections());
    },
    [latestSections, refuse],
  );

  const select = useCallback((id: string) => {
    setSelectedId(prev => (prev === id ? null : id));
  }, []);

  const selectOnly = useCallback((id: string) => setSelectedId(id), []);

  const clearSelection = useCallback(() => setSelectedId(null), []);

  const add = useCallback(
    (section: Pick<Section, 'name' | 'code'>, atIndex?: number) =>
      mutate(current => {
        const next = { code: section.code };

        commit(
          atIndex === undefined || atIndex < 0
            ? [...current, next]
            : [...current.slice(0, atIndex), next, ...current.slice(atIndex)],
        );
      }),
    [commit, mutate],
  );

  const remove = useCallback(
    (id: string) =>
      mutate(current => {
        // Removes by position, so a duplicated id could never delete two
        // sections.
        const index = current.findIndex(s => s.id === id);

        if (index < 0) {
          return;
        }

        // Clear the selection only when the selected section is the one
        // deleted.
        if (id === selectedId) {
          setSelectedId(null);
        }

        commit(current.filter((_, i) => i !== index));
      }),
    [commit, mutate, selectedId],
  );

  const copy = useCallback(
    (id: string) =>
      mutate(current => {
        const index = current.findIndex(s => s.id === id);
        const source = current[index];

        if (!source) {
          return;
        }

        // New `data-id`s for the copy, its own included, so it's a distinct
        // section.
        const committed = commit([
          ...current.slice(0, index + 1),
          { code: replaceIds(source.code) },
          ...current.slice(index + 1),
        ]);

        // Select the copy by the id the committed document gave it (#245).
        setSelectedId(committed[index + 1]?.id ?? null);
      }),
    [commit, mutate],
  );

  const move = useCallback(
    (id: string | null, direction: 'up' | 'down') =>
      mutate(current => {
        const index = current.findIndex(s => s.id === id);
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
          return;
        }

        // The selection follows the section, since its id moves with it.
        commit(arrayMove(current, index, targetIndex));
      }),
    [commit, mutate],
  );

  const reorder = useCallback(
    (activeId: string, overId: string) =>
      mutate(current => {
        const prevIndex = current.findIndex(s => s.id === activeId);
        const nextIndex = current.findIndex(s => s.id === overId);

        if (prevIndex < 0 || nextIndex < 0 || prevIndex === nextIndex) {
          return;
        }

        commit(arrayMove(current, prevIndex, nextIndex));
      }),
    [commit, mutate],
  );

  const patch = useCallback(
    (next: Partial<Section> & { id: string }) =>
      mutate(current => {
        commit(current.map(s => (s.id === next.id ? { ...s, ...next } : s)));
      }),
    [commit, mutate],
  );

  return {
    sections,
    previews,
    selectedId,
    selectedSection,
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
