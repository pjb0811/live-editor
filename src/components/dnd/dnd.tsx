import {
  Children,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  type ScreenReaderInstructions,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Space, Typography } from '@jbpark/ui-kit';
import { useResponsiveSize } from '@jbpark/use-hooks';

import { DRAGGABLE_ITEMS } from '~/constants';
import type { Section } from '~/types';
import {
  type DataAttrNode,
  type DocumentProblem,
  extract,
  fillIds,
  updateAll,
} from '~/utils/ast';
import type { UpdateFailure } from '~/utils/ast';

import { cn } from '../../utils/cn';
import { preloadScripts } from '../../utils/scripts';
import { usePreview } from '../context/states';
import { type FrameProps } from '../frame';
import { useStableModules } from '../preview/use-stable-modules';
import Droppable from './droppable';
import {
  type DndEditError,
  DndEditOptionsContext,
  type DndRenderField,
  toastEditError,
} from './edit-options';
import Layout from './layout';
import { DndRegionContext } from './layout-context';
import Overlay from './overlay';
import {
  type PanelBinding,
  type PanelNodeChange,
  type PanelNodesChange,
  resolvePanelBindings,
  withPanelCommit,
} from './panel-binding';
import Renderer from './renderer';
import {
  type DndRenderSectionFallback,
  SectionFallbackContext,
} from './section-fallback-context';
import Sortable from './sortable';
import { useSectionDocument } from './use-section-document';

// Turn a structured `update` failure into a toast that names the actual
// fault. Before #270 every failure showed "Failed to update this field /
// Check the console for details" — but nothing was logged, so the console
// was empty. Most of these are a wrong `property`/`label` in the element's
// `data-binding`, not the value the author just typed, so the message points
// there. `description` is only set for paths that genuinely log (parse
// errors), so "check the console" is never a dead end again.
const describeUpdateFailure = (
  failure: UpdateFailure | undefined,
  label: string,
): { title: string; description?: string } => {
  switch (failure?.reason) {
    case 'attribute-not-found':
      return {
        title: `Failed to update "${label}"`,
        description: `This element has no "${failure.property}" attribute — check the property in its data-binding.`,
      };
    case 'binding-not-declared':
      return {
        title: `Failed to update "${label}"`,
        description: `No binding for ${
          failure.property
            ? `property "${failure.property}"`
            : `label "${label}"`
        } is declared on this element's data-binding.`,
      };
    case 'duplicate-binding':
      return {
        title: `Failed to update "${label}"`,
        description: `${failure.count} bindings share ${
          failure.property
            ? `property "${failure.property}"`
            : `label "${label}"`
        } on this element — remove the duplicate in its data-binding.`,
      };
    case 'reserved-property':
      return {
        title: `Cannot edit "${label}" in the panel`,
        description: `"${failure.property}" is managed by the editor, so a binding can't change it.`,
      };
    case 'no-binding':
      return {
        title: `Failed to update "${label}"`,
        description: 'This element has no data-binding declaration.',
      };
    case 'element-not-found':
      return {
        title: `Failed to update "${label}"`,
        description: 'The target element could not be found in this section.',
      };
    case 'unsupported-syntax':
      return {
        title: `Cannot edit "${label}" in the panel`,
        description: `The "${failure.property}" expression was preserved. Change it in the code editor instead.`,
      };
    case 'parse-error':
      return {
        title: `Failed to update "${label}"`,
        description:
          failure.error instanceof Error
            ? failure.error.message
            : 'Check the console for details.',
      };
    default:
      return { title: `Failed to update "${label}"` };
  }
};

// Enter is left out of `start` so it can select the focused section (#435).
const KEYBOARD_CODES = {
  start: ['Space'],
  cancel: ['Escape'],
  end: ['Space', 'Enter'],
};

const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'Press Enter to select this section. Press Space to pick it up, the arrow keys to move it, and Space or Enter to drop it. Press Escape to cancel.',
};

// An edit refused because the document doesn't parse (#433).
const blockedEditError = (error: unknown): DndEditError => ({
  type: 'parse',
  target: 'document',
  reason: 'parse-error',
  error,
  title: 'The document has a syntax error',
  description:
    'The canvas shows the last version that parsed. Fix the error in the code, then edit here again.',
});

// What `useDndPalette()` returns. Deliberately just data: the drag wiring is
// a component (`Live.Dnd.DraggableItem`) and the breakpoint belongs to
// `useDndLayout()`, so a custom palette takes each from where it lives
// rather than having all three funnelled through one object.
export interface DndPalette {
  items: Section[];
  // Appends the item to the canvas. Closes the mobile palette Drawer too,
  // which is a no-op wherever it isn't open.
  onAdd: (item: Section) => void;
}

// `PanelNodeChange`/`PanelBinding` live in `./panel-binding` alongside the
// DataAttrNode -> PanelBinding conversion they describe, and are re-exported
// here so `Live.Dnd`'s public types keep their original import path (#340).
export type {
  PanelBinding,
  PanelNodeChange,
  PanelNodesChange,
} from './panel-binding';

// What `useDndPanel()` returns — everything the built-in property panel runs
// on, so a custom panel starts from the same place rather than re-deriving
// any of it.
export interface DndPanel {
  item?: Section;
  onChange: (next: Partial<Section>) => void;
  onDelete: (id: string) => void;
  // Alternative to dragging a section to reorder it — needed since the
  // canvas sits behind the mobile Drawer the panel renders in, so
  // there's nothing visible to drag onto there.
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  // `item`'s editable data-binding fields, already flattened to one entry
  // per bound property (across every non-<section> descendant carrying a
  // `data-binding` attribute). Each entry carries the binding's `type` and
  // current `value` plus an `onChange` wired straight into the same
  // AST-update pipeline the built-in panel uses — including the error Toast
  // on a bad edit. Switch on `type` to render your own control (an
  // `<input>`, `<textarea>`, `<select>`, ...) instead of the built-in one.
  bindings: PanelBinding[];
  // Node-level commit for elements that aren't in `bindings` — the nested
  // data-bound JSX held inside an `items`/`children` value, which the
  // built-in Items/Children editors discover by re-extracting that value's
  // own JSX. Those `data-id`s never reach `bindings` (the top-level
  // `extract()` doesn't walk into an attribute expression), and no single
  // `PanelBinding.onChange` can address them since each one closes over a
  // fixed `id` — hence this `(id, label, property, value)` channel. Hand it
  // to `Live.Dnd.Field` along with the binding, otherwise nested
  // array/children edits inside it silently don't commit (#308).
  onNodeChange: PanelNodeChange;
  // Several node-level edits as one commit: applied in array order, all or
  // none. Reach for it when one interaction writes more than one binding (an
  // image picker setting `src` and `alt`, say), so the host sees a single
  // `onChange` and a failure can't leave half of it behind (#425).
  onNodesChange: PanelNodesChange;
  // True while the document doesn't parse: `item` and `bindings` are from the
  // last version that did, and every commit is refused (and reported through
  // `onEditError`) until the source parses again. Disable your controls, or
  // say why edits aren't landing (#433).
  readOnly: boolean;
}

export interface Props extends Omit<
  React.ComponentPropsWithRef<'div'>,
  'onChange'
> {
  value?: string;
  props?: Record<string, unknown>;
  modules?: Record<string, unknown>;
  items?: Section[];
  frame?: FrameProps;
  dynamicTailwind?: boolean;
  provider?: (children: React.ReactNode) => React.ReactNode;
  onChange?: (value: string) => void;
  // Replaces the built-in control for any field, wherever it renders — the
  // built-in panel, `Live.Dnd.Field` in a custom panel, nested object keys
  // and array item properties. Return `undefined` to keep the built-in one.
  // See `DndRenderField`.
  renderField?: DndRenderField;
  // Receives every edit the editor could not apply. When set, the built-in
  // error toast is not shown; the payload carries the same title and
  // description so a host can show them its own way.
  onEditError?: (error: DndEditError) => void;
  // Renders in place of a canvas section that failed to compile, threw while
  // rendering, or was skipped by `shouldForceSectionFallback`. Return
  // `undefined` for the built-in error box. See `DndSectionFallbackArgs`.
  renderSectionFallback?: DndRenderSectionFallback;
  // Checked for every section before it is compiled. Return `true` to skip
  // compiling it (so none of its top-level code runs) and render the
  // fallback with reason `forced`.
  shouldForceSectionFallback?: (section: Section) => boolean;
  // Asked before a section is deleted, from the canvas, the panel, or a
  // custom panel's `onDelete`. Return `false` (or a promise of it) to keep the
  // section; use it to show your own confirmation. Deleting is immediate and
  // has no undo inside `Live.Dnd`, so this is the host's chance to ask (#435).
  onBeforeDelete?: (section: Section) => boolean | Promise<boolean>;
  // Names a section whose `<section>` has no `data-name`, from its 0-based
  // position on the canvas. The name shows on the canvas, in the panel and
  // in `renderSectionFallback`'s `section`. Defaults to "Section 1",
  // "Section 2", ...
  sectionNameFallback?: (index: number) => string;
  // The `id` of the element whose `<section>` children are the document's
  // sections. Defaults to `app-container`. A document without that element
  // has no sections, and `onEditError` (or the toast) says so. Start a new
  // document with `createDocument({ containerId })` from
  // `@jbpark/live-editor/utils`. Without a `value`, `Live.Dnd` starts from
  // the default template, which uses `app-container`, so pass a `value`
  // when you change this.
  containerId?: string;
  // The single customization slot. Omit it for the built-in editor. Supply
  // it and you own the arrangement: compose `Live.Dnd.Palette` /
  // `Live.Dnd.Canvas` / `Live.Dnd.Panel` (each the built-in region, in the
  // container it needs) and your own components in any structure you like.
  // The drag context wraps all of it, so drag-and-drop and field editing
  // keep working wherever a region lands. Your components read the same data
  // the built-ins do through `useDndPalette()` / `useDndPanel()` /
  // `useDndLayout()`.
  //
  // Note this replaces the mobile chrome too — the FAB and both Drawers live
  // in `Live.Dnd.Layout`, which is what runs when children are omitted.
  // Render it yourself (`<Live.Dnd.Layout panel={<MyPanel />} />`) to keep
  // the built-in arrangement while swapping one region. Render `Canvas` at
  // most once either way.
  children?: React.ReactNode;
}

const conditionalModifiers: Modifier = args => {
  const { active } = args;

  if (active?.data.current?.type === 'new-item') {
    return args.transform;
  }

  return restrictToVerticalAxis(args);
};

// Shared, not `= {}` in the parameter list: a fresh object on every render
// is a new `modules` prop for every section, which defeats `Renderer`'s memo
// (#97) and re-runs `compile()` for every section on every edit. Past the
// compilation cache's limit that meant recompiling most sections with Babel
// per keystroke-commit — 1.4 s per edit at 90 sections (#348).
const NO_MODULES: Record<string, unknown> = {};

const Dnd = ({
  value: _value,
  props,
  modules: _modules = NO_MODULES,
  onChange: _onChange,
  className,
  items = [],
  frame,
  dynamicTailwind = false,
  provider,
  renderField,
  onEditError,
  renderSectionFallback,
  shouldForceSectionFallback,
  onBeforeDelete,
  sectionNameFallback,
  containerId,
  children,
  ...restProps
}: Props) => {
  const modules = useStableModules(_modules);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  const { breakpoint } = useResponsiveSize();
  const isMobile = breakpoint.current === 'xs' || breakpoint.current === 'sm';

  // Read-only here — `useSectionDocument` below owns `setCode` (the commit
  // side). `code` is still needed locally: it feeds `value`'s fallback
  // chain just below, and `value` itself is read again further down for
  // the drag overlay's `fullCode` — not something `useSectionDocument`
  // exposes back out.
  const { code } = usePreview();

  // A throwing predicate is treated as "not forced" rather than taking the
  // whole editor down with it.
  const isForced = (section: Section) => {
    try {
      return shouldForceSectionFallback?.(section) === true;
    } catch (error) {
      console.error('shouldForceSectionFallback threw', error);

      return false;
    }
  };

  // Space picks a focused section up, the arrow keys move it, and Space or
  // Enter drops it (Escape cancels). Enter doesn't pick up, unlike dnd-kit's
  // default: a focused section is a `role="button"`, and Enter selects it
  // like a click does (see Sortable). Before, sections could be reached with
  // Tab but neither selected nor moved from the keyboard (#435).
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: KEYBOARD_CODES,
    }),
  );

  // dnd-kit announces drags by id, which here is a generated `data-id`.
  const nameOf = (id: string | number, data?: { current?: unknown }) => {
    const current = data?.current as { item?: Section } | undefined;

    return (
      current?.item?.name ??
      sections.find(section => section.id === id)?.name ??
      'section'
    );
  };

  const positionOf = (id: string | number) =>
    sections.findIndex(section => section.id === id) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id, active.data)}.`,
    onDragOver: ({ active, over }) =>
      over && positionOf(over.id) > 0
        ? `${nameOf(active.id, active.data)} moved to position ${positionOf(over.id)} of ${sections.length}.`
        : `${nameOf(active.id, active.data)} is no longer over a position.`,
    onDragEnd: ({ active, over }) =>
      over && positionOf(over.id) > 0
        ? `${nameOf(active.id, active.data)} dropped at position ${positionOf(over.id)} of ${sections.length}.`
        : `${nameOf(active.id, active.data)} dropped.`,
    onDragCancel: ({ active }) =>
      `Moving ${nameOf(active.id, active.data)} was cancelled.`,
  };

  // Uncontrolled usage (`<Live.Dnd />` with no `value`) used to read
  // nothing but DEFAULT_TEMPLATE forever: every edit committed through
  // useSectionDocument writes into PreviewContext, but this component
  // never read `code` back — so the section a reader just dragged in
  // vanished on the very next render. `Client` (preview/client.tsx)
  // resolves the same dual-source situation by distinguishing an omitted
  // prop from an explicitly empty string; mirror that contract here. The
  // ContextProvider supplies DEFAULT_TEMPLATE for a fresh document.
  const value = _value === undefined ? code : _value;

  const reportError = onEditError ?? toastEditError;

  // Read through a ref so the effects below fire once per failure, not again
  // on every render a host passes a fresh inline `onEditError`.
  const reportErrorRef = useRef(reportError);

  useEffect(() => {
    reportErrorRef.current = reportError;
  });

  // Reported only when an author tries to edit, not whenever the source
  // stops parsing: that happens on most keystrokes in the code editor, and
  // the canvas already says it's showing the last valid version (#433).
  const onBlockedEdit = useCallback((problem: DocumentProblem) => {
    if (problem.reason === 'parse-error') {
      reportErrorRef.current(blockedEditError(problem.error));
    }
  }, []);

  const {
    sections,
    previews,
    selectedId,
    selectedItem,
    selectedIndex,
    select,
    clearSelection,
    add: addItem,
    remove,
    copy: onCopy,
    move: moveSection,
    reorder,
    patch,
    getCommittedSection,
    problem,
    stale,
  } = useSectionDocument(value, _onChange, {
    containerId,
    sectionNameFallback,
    onBlockedEdit,
  });

  // The container id the document is missing, or `null`.
  const missingContainer =
    problem?.reason === 'container-not-found' ? problem.containerId : null;

  const onDragStart = (_: DragStartEvent) => {};

  const onDragOver = (_e: DragOverEvent) => {};

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      return;
    }

    if (active.data.current?.type === 'new-item') {
      const item = active.data.current.item as Section;
      const atBottom =
        over.id === 'sortable-area' || over.id === 'sortable-area-bottom';

      addItem(
        item,
        atBottom ? undefined : sections.findIndex(s => s.id === over.id),
      );
      return;
    }

    if (active.id !== over.id && sections.some(s => s.id === active.id)) {
      reorder(String(active.id), String(over.id));
    }
  };

  const onSelect = (id: string) => select(id);

  // Read through a ref after an async `onBeforeDelete`: while a confirmation
  // is open the document can change, and the `remove` from the render that
  // asked would commit against the document as it was then.
  const removeRef = useRef(remove);

  useEffect(() => {
    removeRef.current = remove;
  });

  const onDelete = (id: string) => {
    const section = sections.find(candidate => candidate.id === id);

    if (!onBeforeDelete || !section) {
      remove(id);

      return;
    }

    const decide = (allowed: boolean) => {
      if (allowed) {
        removeRef.current(id);
      }
    };

    try {
      const answer = onBeforeDelete(section);

      if (typeof answer === 'boolean') {
        decide(answer);

        return;
      }

      answer.then(decide, error => {
        console.error('onBeforeDelete rejected; the section was kept', error);
      });
    } catch (error) {
      console.error('onBeforeDelete threw; the section was kept', error);
    }
  };

  const onChange = (next: Partial<Section>) => {
    if (!next.id) {
      return;
    }

    patch(next as Partial<Section> & { id: string });
  };

  // Reads only the extracted `code` local, not `selectedItem`, so the
  // compiler can verify this dependency array actually matches what the
  // body reads — matches Panel's own former version of this same logic,
  // now shared here so both the built-in Panel and a custom one built on
  // `useDndPanel()` get the same extraction/update pipeline instead of each
  // needing it.
  const selectedCode = selectedItem?.code;
  const { fields, updatedCode, parseError } = useMemo(() => {
    if (!selectedCode) {
      return {
        fields: [] as DataAttrNode[],
        updatedCode: '',
        parseError: null,
      };
    }

    try {
      const updated = fillIds(selectedCode);
      // Every element, the section's own root included: a `<section>` with a
      // `data-binding` is editable like any other element, and one without
      // resolves to no bindings below. It used to be dropped here, so a
      // binding written on the section itself was silently ignored (#429).
      const allNodes = extract(updated);

      return {
        fields: allNodes,
        updatedCode: updated !== selectedCode ? updated : selectedCode,
        parseError: null,
      };
    } catch (e) {
      console.warn('⚠️ Parsing error', e);
      return {
        fields: [] as DataAttrNode[],
        updatedCode: '',
        parseError: { error: e },
      };
    }
  }, [selectedCode]);

  // Keyed on the missing id alone, so it fires when a document reaches this
  // state and not again for every edit that leaves it there.
  useEffect(() => {
    if (missingContainer !== null) {
      reportErrorRef.current({
        type: 'parse',
        target: 'document',
        reason: 'container-not-found',
        containerId: missingContainer,
        title: `No #${missingContainer} element in the document`,
        description: `Sections are the <section> elements inside the element with id="${missingContainer}". Start from createDocument(), or set containerId to match your document.`,
      });
    }
  }, [missingContainer]);

  useEffect(() => {
    if (parseError) {
      reportErrorRef.current({
        type: 'parse',
        target: 'section',
        error: parseError.error,
        title: 'Failed to parse this section',
        description: 'Check the console for details.',
      });
    }
  }, [parseError]);

  // The one commit path for panel edits, whether one node or several. A single
  // `PanelNodeChange` is a batch of one, so the guards and the base document
  // below can't drift between the two (#425).
  const commitChanges = (changes: Parameters<PanelNodeChange>[0][]) => {
    if (changes.length === 0) {
      return;
    }

    // The fields show the last version that parsed while the source doesn't,
    // and their ids point into that version, not the current source (#433).
    if (stale && problem?.reason === 'parse-error') {
      reportError(blockedEditError(problem.error));
      return;
    }

    // Builds on an earlier commit from this same tick when that commit
    // changed this section: `updatedCode` is this render's snapshot, so a
    // second commit made from it would write the first one's edit back out
    // (#450). A section the earlier commit left alone (a sibling was added,
    // say) still reads as `selectedCode`, whose empty `data-id`s haven't been
    // filled yet — `updatedCode` holds the ids the bindings point at.
    const committed =
      selectedItem && getCommittedSection(selectedItem.id)?.code;
    const base =
      committed && committed !== selectedCode ? committed : updatedCode;
    const result = updateAll(
      base,
      changes.map(({ id, label, property, value: changeValue }) => ({
        dataId: id,
        label,
        property,
        value: changeValue,
      })),
    );

    if (!result.success) {
      const { id, label, property } = changes[result.index]!;

      reportError({
        type: 'update',
        id,
        label,
        property,
        failure: result.failure,
        ...describeUpdateFailure(result.failure, label),
      });
      return;
    }

    if (selectedItem) {
      onChange({ ...selectedItem, code: result.code });
    }
  };

  const onFieldChange: PanelNodeChange = change => commitChanges([change]);

  // Flattens the extracted `fields` (one DataAttrNode per element) down to
  // one descriptor per bound property — the same walk the built-in
  // FieldEditor/Node does internally (data-id + parsed data-binding +
  // current value). Everything here is derived from `fields` alone, so the
  // memo key is honest and the parse/read work still happens once per
  // parsed section.
  //
  // Deliberately no `onChange`: a callback belongs to the render that made
  // it, not to the parse. Keeping the two in one memo is what caused #336 —
  // editing another section leaves `selectedCode` (and therefore `fields`)
  // identical, so the memo was reused and handed back callbacks still bound
  // to the previous document, whose commit wrote the sibling's old source
  // back over the newer one.
  const bindingFields = useMemo(
    () => fields.flatMap(node => resolvePanelBindings(node)?.bindings ?? []),
    [fields],
  );

  // Bound fresh each render on top of the memo above — the same split
  // `useDndItems` uses for its `items`. This is a plain walk of an
  // already-parsed result with no Babel in it, and it's what guarantees a
  // commit reads the current `updatedCode`/`selectedItem`/`onChange`.
  //
  // The identity churn the previous memo was guarding against was never
  // real: the `DndRegionContext` value and the `panel` object holding this
  // array are both fresh object literals every render, so every
  // `useDndPanel()` consumer already re-rendered regardless.
  const bindings: PanelBinding[] = withPanelCommit(
    bindingFields,
    onFieldChange,
  );

  useEffect(() => {
    if (frame?.scripts?.length) {
      preloadScripts(frame.scripts);
    }
  }, [frame?.scripts]);

  // Data, not nodes: the built-in palette and panel read these back through
  // `useDndPalette()`/`useDndPanel()` exactly as a custom one does, so
  // there's a single path and no way for the public surface to drift into a
  // subset of what the built-ins use — the point of #237.
  const palette: DndPalette = {
    items: items?.length ? items : DRAGGABLE_ITEMS,
    onAdd: (item: Section) => {
      addItem(item);
      setMobilePaletteOpen(false);
    },
  };

  const panel: DndPanel = {
    item: selectedItem,
    onChange,
    onDelete,
    onMoveUp: () => moveSection(selectedId, 'up'),
    onMoveDown: () => moveSection(selectedId, 'down'),
    canMoveUp: selectedIndex > 0,
    canMoveDown: selectedIndex >= 0 && selectedIndex < sections.length - 1,
    bindings,
    onNodeChange: onFieldChange,
    onNodesChange: commitChanges,
    readOnly: stale,
  };

  // Content only — the frame container that wraps this (`data-frame-container`
  // plus the containment styles) belongs to `Live.Dnd.Canvas`, so a custom
  // layout can't accidentally drop it while still placing the canvas.
  const canvas = (
    <>
      {stale && (
        <div
          role="status"
          className={cn(
            'sticky top-0 z-70',
            'border-b border-amber-200 bg-amber-50 px-3 py-2',
            'text-sm text-amber-900',
          )}
        >
          Showing the last version that parsed. Fix the syntax error in the code
          to edit here again.
        </div>
      )}
      <Droppable
        className={cn(
          !sections.length && 'h-full',
          //
        )}
      >
        {!sections.length ? (
          <div
            className={cn(
              'flex items-center justify-center',
              'h-full',
              'text-gray-500',
            )}
          >
            {problem?.reason === 'parse-error' ? (
              <Space orientation="vertical" align="center">
                <Typography.Paragraph>
                  The document has a syntax error
                </Typography.Paragraph>
                <Typography.Text>
                  Fix it in the code to see its sections
                </Typography.Text>
              </Space>
            ) : missingContainer !== null ? (
              <Space orientation="vertical" align="center">
                <Typography.Paragraph>
                  No #{missingContainer} element in the document
                </Typography.Paragraph>
                <Typography.Text>
                  Sections go inside the element with id=&quot;
                  {missingContainer}&quot;
                </Typography.Text>
              </Space>
            ) : (
              <Space orientation="vertical" align="center">
                <Typography.Paragraph>
                  No sections available
                </Typography.Paragraph>
                <Typography.Text>
                  {isMobile
                    ? 'Tap a component to add it'
                    : 'Drag a component from the left to add it'}
                </Typography.Text>
              </Space>
            )}
          </div>
        ) : (
          <SortableContext
            items={sections.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section, index) => (
              <Sortable
                key={section.id}
                id={section.id}
                name={section.name}
                selected={selectedId === section.id}
                onClick={() => onSelect(section.id)}
                onDelete={onDelete}
                onCopy={onCopy}
              >
                <Renderer
                  preview={previews[index]!}
                  sectionId={section.id}
                  sectionName={section.name}
                  sectionCode={section.code}
                  forceFallback={isForced(section)}
                  modules={modules}
                  frame={frame}
                  dynamicTailwind={dynamicTailwind}
                  provider={provider}
                  {...props}
                />
              </Sortable>
            ))}
          </SortableContext>
        )}
      </Droppable>
    </>
  );

  return (
    <SectionFallbackContext.Provider value={renderSectionFallback}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          announcements,
          screenReaderInstructions: SCREEN_READER_INSTRUCTIONS,
        }}
        modifiers={[
          conditionalModifiers,
          //
        ]}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div
          className={cn(
            'relative flex h-full w-full',
            className,
            //
          )}
          {...restProps}
        >
          {/* Not memoized: `palette`, `panel` and `canvas` are all rebuilt
              each render anyway, so a memo would only add a dependency list
              to keep in sync. */}
          <DndEditOptionsContext.Provider value={{ renderField, reportError }}>
            <DndRegionContext.Provider
              value={{
                palette,
                panel,
                canvas,
                isMobile,
                selectedId,
                clearSelection,
                paletteOpen: mobilePaletteOpen,
                setPaletteOpen: setMobilePaletteOpen,
                documentError: problem?.reason ?? null,
              }}
            >
              {/* `Children.toArray` rather than a plain `children ??`: a JSX
                comment, or a `{cond && <MyLayout />}` that fell through,
                leaves `children` set but empty — and honouring that
                literally renders an editor with no regions at all, which
                looks like a broken build rather than a mistake in the
                layout. Falling back keeps the failure legible. */}
              {Children.toArray(children).length ? children : <Layout />}
            </DndRegionContext.Provider>
          </DndEditOptionsContext.Provider>
        </div>
        <DragOverlay>
          <Overlay
            sections={sections}
            isForced={isForced}
            renderProps={{
              fullCode: value,
              modules,
              frame,
              dynamicTailwind,
              ...props,
              // After the spread, so a preview prop with the same name can't
              // point the overlay at a different container.
              containerId,
            }}
          />
        </DragOverlay>
      </DndContext>
    </SectionFallbackContext.Provider>
  );
};

export default Dnd;
