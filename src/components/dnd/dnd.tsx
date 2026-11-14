import { Children, useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type Modifier,
  closestCenter,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useLatest,
  useResponsiveSize,
  useStableValue,
} from '@jbpark/use-hooks';

import { PALETTE_SECTIONS } from '~/constants';
import type { Section } from '~/types';
import type { DocumentProblem } from '~/utils/ast/document';
import { type BindingOptions } from '~/utils/ast/types';

import canvasStyles from './canvas/canvas.module.css';
import layoutStyles from './layout.module.css';

import { cn } from '../../utils/cn';
import { preloadScripts } from '../../utils/scripts';
import type { LiveMessages } from '../context/messages';
import { usePreview } from '../context/states';
import CanvasNotice from './canvas/canvas-notice';
import Droppable from './canvas/droppable';
import InspectorHighlight from './canvas/inspector-highlight';
import Overlay from './canvas/overlay';
import Renderer from './canvas/renderer';
import { SectionFallbackContext } from './canvas/section-fallback-context';
import {
  type SectionHandlers,
  SectionHandlersContext,
} from './canvas/section-handlers';
import Sortable from './canvas/sortable';
import { DndEditOptionsContext } from './edit-options';
import { DndInspectorContext } from './inspector';
import Layout from './layout';
import { DndRegionContext } from './layout-context';
import { paletteSectionOf } from './palette/palette-drag';
import { useEditErrors } from './state/edit-errors';
import { useDeleteFlow } from './state/use-delete-flow';
import { useDndKeyboard } from './state/use-dnd-keyboard';
import { useInspectorState } from './state/use-inspector-state';
import { useSectionDocument } from './state/use-section-document';
import { useSectionEditing } from './state/use-section-editing';
import type { DndPalette, DndPanel, DndSections, Props } from './types';

const conditionalModifiers: Modifier = args => {
  const { active } = args;

  if (paletteSectionOf(active?.data)) {
    return args.transform;
  }

  return restrictToVerticalAxis(args);
};

// One shared empty object. A new `{}` on every render would be a new
// `modules` prop for every section, which breaks `Renderer`'s memo and
// recompiles every section on every edit (#97, #348).
const NO_MODULES: Record<string, unknown> = {};

// The title and detail an empty canvas shows: the document doesn't parse,
// its container is missing, or it has no sections yet.
const emptyCanvasNotice = (
  messages: LiveMessages,
  problem: DocumentProblem | null,
  isMobile: boolean,
) => {
  if (problem?.reason === 'parse-error') {
    return {
      title: messages.canvas.syntaxError,
      detail: messages.canvas.syntaxErrorDetail,
    };
  }

  if (problem?.reason === 'container-not-found') {
    return {
      title: messages.canvas.missingContainer(problem.containerId),
      detail: messages.canvas.missingContainerDetail(problem.containerId),
    };
  }

  return {
    title: messages.canvas.empty,
    detail: isMobile
      ? messages.canvas.emptyHintTouch
      : messages.canvas.emptyHintDrag,
  };
};

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
  bindings: bindingRegistry,
  bindingKeys,
  onNodePick,
  onSelectionChange,
  canvasWidth: _canvasWidth,
  onUpload,
  children,
  ...restProps
}: Props) => {
  const modules = useStableValue(_modules);
  // Anything but a positive number fills the canvas.
  const canvasWidth =
    typeof _canvasWidth === 'number' &&
    Number.isFinite(_canvasWidth) &&
    _canvasWidth > 0
      ? _canvasWidth
      : undefined;
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  const { breakpoint } = useResponsiveSize();
  // dnd-kit otherwise names its ids from a counter that keeps growing on a
  // server, so they differ from the client's on hydration (#716).
  const dndContextId = useId();
  const isMobile = breakpoint.current === 'xs' || breakpoint.current === 'sm';

  // Only read here, for `value` below. `useSectionDocument` writes it.
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

  // The host's `value` when it passes one (controlled), otherwise the
  // provider's code. An empty string counts as a value, as in `Live.Preview`.
  const value = _value === undefined ? code : _value;

  const { reportError, messages, onBlockedEdit, reportLatest } =
    useEditErrors(onEditError);

  const {
    sections,
    previews,
    selectedId,
    selectedSection,
    selectedIndex,
    select,
    selectOnly,
    clearSelection,
    add: addSection,
    remove,
    copy: onCopy,
    move: moveSection,
    reorder,
    moveTo,
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

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const section = paletteSectionOf(active.data);

    if (section) {
      const atBottom =
        over.id === 'sortable-area' || over.id === 'sortable-area-bottom';

      addSection(
        section,
        atBottom ? undefined : sections.findIndex(s => s.id === over.id),
      );
      return;
    }

    if (active.id !== over.id && sections.some(s => s.id === active.id)) {
      reorder(String(active.id), String(over.id));
    }
  };

  const onSelect = (id: string) => select(id);

  const requestDelete = useDeleteFlow({ sections, remove, onBeforeDelete });

  const onDelete = (id: string) => requestDelete(id);

  const {
    sensors,
    announcements,
    screenReaderInstructions,
    sectionNodes,
    onNavigate,
    onDeleteKey,
    onMoveKey,
    onCopyKey,
    onMoveButton,
  } = useDndKeyboard({
    sections,
    selectedId,
    selectedIndex,
    selectOnly,
    move: moveSection,
    copy: onCopy,
    requestDelete,
  });

  const {
    inspector,
    inspecting,
    onInspectMove,
    onInspectPick,
    onInspectLeave,
    highlightRect,
  } = useInspectorState({ selectedId, selectOnly, sectionNodes, onNodePick });

  const onChange = (next: Partial<Section>) => {
    if (!next.id) {
      return;
    }

    patch(next as Partial<Section> & { id: string });
  };

  // One object for everything below, renewed only when a map changes, so
  // memos that depend on it don't re-run every render (#513).
  const bindingOptions = useMemo<BindingOptions>(
    () => ({ bindings: bindingRegistry, bindingKeys }),
    [bindingRegistry, bindingKeys],
  );
  const { bindings, onFieldChange, commitChanges } = useSectionEditing({
    selectedSection,
    stale,
    problem,
    missingContainer,
    getCommittedSection,
    onChange,
    bindingOptions,
    reportError,
    messages,
    reportLatest,
  });

  // The selection as the document has it: a selected id whose section is
  // gone counts as nothing selected.
  const effectiveSelectedId = selectedSection?.id ?? null;
  const onSelectionChangeRef = useLatest(onSelectionChange);
  const reportedSelectionRef = useRef<string | null>(null);

  useEffect(() => {
    if (reportedSelectionRef.current === effectiveSelectedId) {
      return;
    }

    reportedSelectionRef.current = effectiveSelectedId;
    onSelectionChangeRef.current?.(selectedSection ?? null);
    // Reported per id: an edit inside the selected section isn't a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSelectedId]);

  useEffect(() => {
    if (frame?.scripts?.length) {
      preloadScripts(frame.scripts);
    }
  }, [frame?.scripts]);

  // Data, not components: the built-in palette and panel read these through
  // `useDndPalette()` and `useDndPanel()`, the same way a custom one does
  // (#237).
  const palette: DndPalette = {
    items: items?.length ? items : PALETTE_SECTIONS,
    onAdd: (section: Section) => {
      addSection(section);
      setMobilePaletteOpen(false);
    },
  };

  const panel: DndPanel = {
    item: selectedSection,
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
    bindingOptions,
  };

  const sectionsApi: DndSections = {
    sections,
    selectedId: effectiveSelectedId,
    select: id => {
      if (id === null) {
        clearSelection();

        return;
      }

      if (sections.some(section => section.id === id)) {
        selectOnly(id);
      }
    },
    move: moveSection,
    moveTo,
    duplicate: onCopy,
    remove: id => requestDelete(id),
    readOnly: stale,
  };

  const sectionHandlers: SectionHandlers = {
    inspecting,
    onInspectMove,
    onInspectPick,
    onInspectLeave,
    nodeRef: sectionNodes.register,
    onNavigate,
    onDeleteKey,
    onMoveKey,
    onCopyKey,
  };

  // The canvas content. Its frame container belongs to `Live.Dnd.Canvas`, so
  // a custom layout can't leave it out.
  const canvas = (
    <SectionHandlersContext.Provider value={sectionHandlers}>
      {stale && (
        <div role="status" className={canvasStyles.stale}>
          {messages.canvas.stale}
        </div>
      )}
      <Droppable
        className={cn(!sections.length && canvasStyles.fill)}
        width={canvasWidth}
      >
        {!sections.length ? (
          <div className={canvasStyles.empty}>
            <CanvasNotice {...emptyCanvasNotice(messages, problem, isMobile)} />
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
                onMoveUp={() => onMoveButton(section.id, 'up')}
                onMoveDown={() => onMoveButton(section.id, 'down')}
                canMoveUp={index > 0}
                canMoveDown={index < sections.length - 1}
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
                  componentProps={props}
                />
              </Sortable>
            ))}
          </SortableContext>
        )}
      </Droppable>
      <InspectorHighlight rect={highlightRect} />
    </SectionHandlersContext.Provider>
  );

  return (
    <SectionFallbackContext.Provider value={renderSectionFallback}>
      <DndContext
        id={dndContextId}
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          announcements,
          screenReaderInstructions,
        }}
        modifiers={[
          conditionalModifiers,
          //
        ]}
        onDragEnd={onDragEnd}
      >
        <div className={cn(layoutStyles.root, className)} {...restProps}>
          {/* Not memoized: `palette`, `panel` and `canvas` are new every
              render anyway. */}
          <DndEditOptionsContext.Provider
            value={{ renderField, reportError, bindingOptions, onUpload }}
          >
            <DndRegionContext.Provider
              value={{
                palette,
                panel,
                sections: sectionsApi,
                canvas,
                isMobile,
                selectedId,
                clearSelection,
                paletteOpen: mobilePaletteOpen,
                setPaletteOpen: setMobilePaletteOpen,
                documentError: problem?.reason ?? null,
                canvasWidth,
              }}
            >
              {/* The built-in layout when `children` renders nothing, such
                as only a JSX comment or a `{cond && <MyLayout />}` that is
                false. An editor with no regions would look broken. */}
              <DndInspectorContext.Provider value={inspector}>
                {Children.toArray(children).length ? children : <Layout />}
              </DndInspectorContext.Provider>
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
              componentProps: props,
              containerId,
            }}
          />
        </DragOverlay>
      </DndContext>
    </SectionFallbackContext.Provider>
  );
};

export default Dnd;
