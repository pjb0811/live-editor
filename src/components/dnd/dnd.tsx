import {
  Children,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
import { Space, Typography } from '@jbpark/ui-kit';
import { useResponsiveSize } from '@jbpark/use-hooks';

import { DRAGGABLE_ITEMS } from '~/constants';
import type { Section } from '~/types';
import { type DocumentProblem } from '~/utils/ast/document';
import { extract } from '~/utils/ast/extract';
import { fillIdsFrom } from '~/utils/ast/tree';
import { type BindingOptions, type DataAttrNode } from '~/utils/ast/types';
import { updateAll } from '~/utils/ast/update';
import type { UpdateFailure } from '~/utils/ast/update';

import { cn } from '../../utils/cn';
import { preloadScripts } from '../../utils/scripts';
import { type LiveMessages, useLiveMessages } from '../context/messages';
import { usePreview } from '../context/states';
import { useStableModules } from '../preview/use-stable-modules';
import Droppable from './droppable';
import {
  type DndEditError,
  DndEditOptionsContext,
  toastEditError,
} from './edit-options';
import { DndInspectorContext } from './inspector';
import InspectorHighlight from './inspector-highlight';
import Layout from './layout';
import { DndRegionContext } from './layout-context';
import Overlay from './overlay';
import {
  type PanelBinding,
  type PanelNodeChange,
  resolvePanelBindings,
  withPanelCommit,
} from './panel-binding';
import Renderer from './renderer';
import { SectionFallbackContext } from './section-fallback-context';
import Sortable from './sortable';
import type { DndPalette, DndPanel, Props } from './types';
import { useDeleteFlow } from './use-delete-flow';
import { useDndKeyboard } from './use-dnd-keyboard';
import { useInspectorState } from './use-inspector-state';
import { useSectionDocument } from './use-section-document';

// Turns an `update` failure into the edit error's title and description.
// The description names the cause, which is usually in the element's
// `data-binding` rather than in the value just typed (#270).
const describeUpdateFailure = (
  failure: UpdateFailure | undefined,
  label: string,
  { editErrors: m }: LiveMessages,
): { title: string; description?: string } => {
  switch (failure?.reason) {
    case 'attribute-not-found':
      return {
        title: m.updateFailed(label),
        description: m.attributeNotFound(failure.property),
      };
    case 'binding-not-declared':
      return {
        title: m.updateFailed(label),
        description: m.bindingNotDeclared({
          label,
          property: failure.property,
        }),
      };
    case 'duplicate-binding':
      return {
        title: m.updateFailed(label),
        description: m.duplicateBinding({
          count: failure.count,
          label,
          property: failure.property,
        }),
      };
    case 'reserved-property':
      return {
        title: m.cannotEdit(label),
        description: m.reservedProperty(failure.property),
      };
    case 'required-property':
      return {
        title: m.cannotRemove(label),
        description: m.requiredProperty(failure.property),
      };
    case 'no-binding':
      return { title: m.updateFailed(label), description: m.noBinding };
    case 'element-not-found':
      return { title: m.updateFailed(label), description: m.elementNotFound };
    case 'self-closing':
      return {
        title: m.cannotEdit(label),
        description: m.selfClosing(failure.property),
      };
    case 'unsupported-syntax':
      return {
        title: m.cannotEdit(label),
        description: m.unsupportedSyntax(failure.property),
      };
    case 'parse-error':
      return {
        title: m.updateFailed(label),
        description:
          failure.error instanceof Error
            ? failure.error.message
            : m.checkConsole,
      };
    default:
      return { title: m.updateFailed(label) };
  }
};

// An edit refused because the document doesn't parse (#433).
const blockedEditError = (
  error: unknown,
  { editErrors: m }: LiveMessages,
): DndEditError => ({
  type: 'parse',
  target: 'document',
  reason: 'parse-error',
  error,
  title: m.syntaxError,
  description: m.syntaxErrorDetail,
});

const conditionalModifiers: Modifier = args => {
  const { active } = args;

  if (active?.data.current?.type === 'new-item') {
    return args.transform;
  }

  return restrictToVerticalAxis(args);
};

// One shared empty object. A new `{}` on every render would be a new
// `modules` prop for every section, which breaks `Renderer`'s memo and
// recompiles every section on every edit (#97, #348).
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
  bindings: bindingRegistry,
  bindingKeys,
  onNodePick,
  children,
  ...restProps
}: Props) => {
  const modules = useStableModules(_modules);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  const { breakpoint } = useResponsiveSize();
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

  const messages = useLiveMessages();
  const reportError = onEditError ?? toastEditError;

  // Read through refs, so the effects below report each failure once, even
  // when the host passes a new `onEditError` or new messages every render.
  const reportErrorRef = useRef(reportError);
  const messagesRef = useRef(messages);

  useEffect(() => {
    reportErrorRef.current = reportError;
    messagesRef.current = messages;
  });

  // Reports an edit refused because the source doesn't parse. A source that
  // stops parsing isn't reported by itself: that happens on most keystrokes,
  // and the canvas already says so (#433).
  const onBlockedEdit = useCallback((problem: DocumentProblem) => {
    if (problem.reason === 'parse-error') {
      reportErrorRef.current(
        blockedEditError(problem.error, messagesRef.current),
      );
    }
  }, []);

  const {
    sections,
    previews,
    selectedId,
    selectedItem,
    selectedIndex,
    select,
    selectOnly,
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

  const requestDelete = useDeleteFlow({ sections, remove, onBeforeDelete });

  const onDelete = (id: string) => requestDelete(id);

  const {
    sensors,
    announcements,
    screenReaderInstructions,
    sectionNodes,
    onNavigate,
    onDeleteKey,
    onMoveButton,
  } = useDndKeyboard({
    sections,
    selectedId,
    selectedIndex,
    selectOnly,
    move: moveSection,
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
  // The selected section's elements, parsed again only when its code or id
  // changes.
  const selectedCode = selectedItem?.code;
  const selectedSectionId = selectedItem?.id;
  const { fields, updatedCode, parseError } = useMemo(() => {
    if (!selectedCode) {
      return {
        fields: [] as DataAttrNode[],
        updatedCode: '',
        parseError: null,
      };
    }

    try {
      // The same ids the canvas preview fills this section with, so an
      // element's `data-id` there matches its fields here (#432).
      const updated = fillIdsFrom(selectedCode, selectedSectionId ?? '');
      // Every element, the `<section>` itself included, so a binding on the
      // section is editable too (#429).
      const allNodes = extract(updated, bindingOptions);

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
  }, [selectedCode, selectedSectionId, bindingOptions]);

  // Keyed on the missing id alone, so it fires when a document reaches this
  // state and not again for every edit that leaves it there.
  useEffect(() => {
    if (missingContainer !== null) {
      reportErrorRef.current({
        type: 'parse',
        target: 'document',
        reason: 'container-not-found',
        containerId: missingContainer,
        title:
          messagesRef.current.editErrors.missingContainer(missingContainer),
        description:
          messagesRef.current.editErrors.missingContainerDetail(
            missingContainer,
          ),
      });
    }
  }, [missingContainer]);

  useEffect(() => {
    if (parseError) {
      reportErrorRef.current({
        type: 'parse',
        target: 'section',
        error: parseError.error,
        title: messagesRef.current.editErrors.sectionParseFailed,
        description: messagesRef.current.editErrors.checkConsole,
      });
    }
  }, [parseError]);

  // The one commit path for panel edits. A single edit is a batch of one
  // (#425).
  const commitChanges = (changes: Parameters<PanelNodeChange>[0][]) => {
    if (changes.length === 0) {
      return;
    }

    // The fields show the last version that parsed while the source doesn't,
    // and their ids point into that version, not the current source (#433).
    if (stale && problem?.reason === 'parse-error') {
      reportError(blockedEditError(problem.error, messages));
      return;
    }

    // If an earlier commit in this same tick changed this section, build on
    // its result: starting from this render's `updatedCode` would undo it
    // (#450). Otherwise use `updatedCode`, which has the filled ids the
    // bindings point at.
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
      bindingOptions,
    );

    if (!result.success) {
      const { id, label, property } = changes[result.index]!;

      reportError({
        type: 'update',
        id,
        label,
        property,
        failure: result.failure,
        ...describeUpdateFailure(result.failure, label, messages),
      });
      return;
    }

    if (selectedItem) {
      onChange({ ...selectedItem, code: result.code });
    }
  };

  const onFieldChange: PanelNodeChange = change => commitChanges([change]);

  // One entry per bound property, from `fields` alone. Don't add `onChange`
  // here: a callback must come from the current render, and this memo can
  // outlive it (#336).
  const bindingFields = useMemo(
    () => fields.flatMap(node => resolvePanelBindings(node)?.bindings ?? []),
    [fields],
  );

  // Adds each binding's `onChange`, made fresh every render so a commit uses
  // the current section and code. It's a cheap walk with no parsing.
  const bindings: PanelBinding[] = withPanelCommit(
    bindingFields,
    onFieldChange,
  );

  useEffect(() => {
    if (frame?.scripts?.length) {
      preloadScripts(frame.scripts);
    }
  }, [frame?.scripts]);

  // Data, not components: the built-in palette and panel read these through
  // `useDndPalette()` and `useDndPanel()`, the same way a custom one does
  // (#237).
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
    bindingOptions,
  };

  // The canvas content. Its frame container belongs to `Live.Dnd.Canvas`, so
  // a custom layout can't leave it out.
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
          {messages.canvas.stale}
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
                  {messages.canvas.syntaxError}
                </Typography.Paragraph>
                <Typography.Text>
                  {messages.canvas.syntaxErrorDetail}
                </Typography.Text>
              </Space>
            ) : missingContainer !== null ? (
              <Space orientation="vertical" align="center">
                <Typography.Paragraph>
                  {messages.canvas.missingContainer(missingContainer)}
                </Typography.Paragraph>
                <Typography.Text>
                  {messages.canvas.missingContainerDetail(missingContainer)}
                </Typography.Text>
              </Space>
            ) : (
              <Space orientation="vertical" align="center">
                <Typography.Paragraph>
                  {messages.canvas.empty}
                </Typography.Paragraph>
                <Typography.Text>
                  {isMobile
                    ? messages.canvas.emptyHintTouch
                    : messages.canvas.emptyHintDrag}
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
                onMoveUp={() => onMoveButton(section.id, 'up')}
                onMoveDown={() => onMoveButton(section.id, 'down')}
                canMoveUp={index > 0}
                canMoveDown={index < sections.length - 1}
                nodeRef={sectionNodes.register(section.id)}
                onNavigate={to => onNavigate(section.id, to)}
                onDeleteKey={() => onDeleteKey(section.id)}
                inspecting={inspecting}
                onInspectMove={onInspectMove}
                onInspectPick={(...args) => onInspectPick(section.id, ...args)}
                onInspectLeave={onInspectLeave}
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
          screenReaderInstructions,
        }}
        modifiers={[
          conditionalModifiers,
          //
        ]}
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
          {/* Not memoized: `palette`, `panel` and `canvas` are new every
              render anyway. */}
          <DndEditOptionsContext.Provider
            value={{ renderField, reportError, bindingOptions }}
          >
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
              {/* The built-in layout when `children` renders nothing, such
                as only a JSX comment or a `{cond && <MyLayout />}` that is
                false. An editor with no regions would look broken. */}
              <DndInspectorContext.Provider value={inspector}>
                {Children.toArray(children).length ? children : <Layout />}
              </DndInspectorContext.Provider>
            </DndRegionContext.Provider>
            <InspectorHighlight rect={highlightRect} />
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
