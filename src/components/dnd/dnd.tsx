import { useEffect, useMemo, useState } from 'react';

import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type Modifier,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button, Drawer, Space, Toast, Typography } from '@jbpark/ui-kit';
import { useResponsiveSize } from '@jbpark/use-hooks';
import { LayoutGrid } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { DRAGGABLE_ITEMS } from '~/constants';
import type { Section } from '~/types';
import {
  type BindingOption,
  type BindingRenderMap,
  type BindingType,
  type DataAttrNode,
  extract,
  fillIds,
  getCurrentValue,
  parseBinding,
  replaceIds,
  update,
} from '~/utils/ast';

import { DEFAULT_TEMPLATE } from '../../constants';
import {
  cn,
  createSectionPreviewCache,
  extractSections,
  preloadScripts,
  replaceSections,
} from '../../utils';
import { usePreview } from '../context/states';
import { type FrameProps } from '../frame';
import DraggableItem, { DefaultDraggableItem } from './draggable';
import Droppable from './droppable';
import Overlay from './overlay';
import Panel from './panel';
import Renderer from './renderer';
import Sortable from './sortable';

export interface PaletteRenderData {
  items: Section[];
  onAdd: (item: Section) => void;
  DraggableItem: typeof DraggableItem;
  // True when the palette is rendering inside the mobile Drawer, where a
  // tap can't be a failed drag attempt (there's nothing to drag onto —
  // the canvas is stacked behind the Drawer) and native dblclick synthesis
  // from double-tap is unreliable on touch. Custom renderPalette
  // implementations should treat a single click/tap as "add" here instead
  // of relying on onDoubleClick.
  isMobile: boolean;
}

export interface PanelRenderData {
  item?: Section;
  onChange: (next: Partial<Section>) => void;
  onDelete: (id: string) => void;
  // Alternative to dragging a section to reorder it — needed since the
  // canvas sits behind the mobile Drawer this panel renders in, so
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
}

// One editable data-binding, flattened out of the selected section for a
// custom renderPanel. Exposes just what a consumer needs to render its own
// control — the declared `type`, the current `value`, and an `onChange`
// that commits through Dnd's AST-update pipeline — so it never has to touch
// DataAttrNode/parseBinding/getCurrentValue itself.
export interface PanelBinding {
  // `data-id` of the owning element — stable across edits.
  id: string;
  // Human-readable label from the binding definition.
  label: string;
  // The bound prop/attribute name (e.g. `children`, `src`, `color`).
  property: string;
  // The declared data-binding type — switch on this to pick a control
  // (`string`/`url` -> <input>, `jsx`/`richtext` -> <textarea>, `boolean`
  // -> checkbox, ...). `undefined` means a plain string binding.
  type?: BindingType;
  // Present when the binding defines a fixed option set (render a <select>).
  options?: BindingOption[];
  // Present for `object`/`array` bindings whose nested keys/items declare
  // their own types — the same map the built-in panel uses to type each
  // nested field instead of falling back to a plain string input.
  render?: BindingRenderMap;
  // Constraints declared on the binding. `min`/`max` apply even though
  // `value` below is a string (see `validateBindingValue`, which coerces
  // numeric strings before comparing).
  min?: number;
  max?: number;
  pattern?: string;
  required?: boolean;
  // Current serialized value — the same string the built-in field receives.
  value: string;
  // Commit a new value through the same AST-update pipeline the built-in
  // panel uses (including the error Toast on a bad edit).
  onChange: (value: string) => void;
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
  // Full replacements for the built-in left palette / right panel — receive
  // the same data/callbacks Dnd itself uses, so drag-and-drop and field
  // editing keep working exactly as before, just with custom markup. Used
  // for both the desktop layout and the mobile drawer, since those already
  // render identical content today.
  renderPalette?: (data: PaletteRenderData) => React.ReactNode;
  renderPanel?: (data: PanelRenderData) => React.ReactNode;
}

const conditionalModifiers: Modifier = args => {
  const { active } = args;

  if (active?.data.current?.type === 'new-item') {
    return args.transform;
  }

  return restrictToVerticalAxis(args);
};

const Dnd = ({
  value: _value,
  props,
  modules = {},
  onChange: _onChange,
  className,
  items = [],
  frame,
  dynamicTailwind = false,
  provider,
  renderPalette,
  renderPanel,
  ...restProps
}: Props) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  const { breakpoint } = useResponsiveSize();
  const isMobile = breakpoint.current === 'xs' || breakpoint.current === 'sm';

  const { setCode } = usePreview();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
  );

  const value = _value || DEFAULT_TEMPLATE;
  const sections = useMemo(() => extractSections(value), [value]);
  const selectedItem = useMemo(
    () => sections.find(s => s.id === selectedId),
    [sections, selectedId],
  );

  // One cache per Dnd instance (lazy `useState` initializer, never
  // replaced) — see createSectionPreviewCache (#131). It's stateful by
  // design (remembers the previous render's previews to reuse the ones
  // that didn't change), which a `useMemo`/`useRef` can't do without
  // touching a ref during render; a cache object stored via `useState`
  // and only ever mutated through its own method isn't subject to that
  // restriction the way `ref.current` is.
  const [previewCache] = useState(() => createSectionPreviewCache());
  const previews = useMemo(
    () => previewCache.compute(value, sections),
    [previewCache, sections, value],
  );

  const onDragStart = (_: DragStartEvent) => {};

  const onDragOver = (_e: DragOverEvent) => {};

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      return;
    }

    if (active.data.current?.type === 'new-item') {
      const newItem = active.data.current.item;
      const newSection = {
        id: uuidv4(),
        name: newItem.name,
        code: newItem.code,
      };

      let nextSections: typeof sections;

      if (over.id === 'sortable-area' || over.id === 'sortable-area-bottom') {
        nextSections = [...sections, newSection];
      } else {
        const overIndex = sections.findIndex(s => s.id === over.id);
        if (overIndex >= 0) {
          nextSections = [
            ...sections.slice(0, overIndex),
            newSection,
            ...sections.slice(overIndex),
          ];
        } else {
          nextSections = [...sections, newSection];
        }
      }

      const nextCode = replaceSections(
        value,
        nextSections.map(s => s.code),
      );

      _onChange?.(nextCode);
      setCode(nextCode);
      return;
    }

    if (active.id !== over.id && sections.some(s => s.id === active.id)) {
      const prevIndex = sections.findIndex(s => s.id === active.id);
      const nextIndex = sections.findIndex(s => s.id === over.id);

      if (prevIndex >= 0 && nextIndex >= 0) {
        const nextSections = arrayMove(sections, prevIndex, nextIndex);

        const nextCode = replaceSections(
          value,
          nextSections.map(s => s.code),
        );

        _onChange?.(nextCode);
        setCode(nextCode);
      }
    }
  };

  const addItem = (item: (typeof DRAGGABLE_ITEMS)[0]) => {
    const newSection = {
      id: uuidv4(),
      name: item.name,
      code: item.code,
    };

    const nextSections = [...sections, newSection];

    const nextCode = replaceSections(
      value,
      nextSections.map(s => s.code),
    );

    _onChange?.(nextCode);
    setCode(nextCode);
  };

  const onDelete = (id: string) => {
    const nextSections = sections.filter(s => s.id !== id);

    setSelectedId(null);

    const nextCode = replaceSections(
      value,
      nextSections.map(s => s.code),
    );

    _onChange?.(nextCode);
    setCode(nextCode);
  };

  const moveSection = (id: string | null, direction: 'up' | 'down') => {
    const index = sections.findIndex(s => s.id === id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (index < 0 || targetIndex < 0 || targetIndex >= sections.length) {
      return;
    }

    const nextSections = arrayMove(sections, index, targetIndex);

    const nextCode = replaceSections(
      value,
      nextSections.map(s => s.code),
    );

    _onChange?.(nextCode);
    setCode(nextCode);
    // Section ids are just the section's positional index, re-derived from
    // scratch on every parse (getSections) rather than a stable identity —
    // so once `sections` recomputes after this reorder, `selectedId`
    // (unchanged) would silently point at whatever content now sits at its
    // old position instead of following the section that actually moved.
    setSelectedId(String(targetIndex));
  };

  const onCopy = (id: string) => {
    const sectionIndex = sections.findIndex(s => s.id === id);
    const sectionToCopy = sections[sectionIndex];

    if (sectionToCopy) {
      const nextId = uuidv4();
      const nextSection = {
        id: nextId,
        code: replaceIds(sectionToCopy.code),
        name: sectionToCopy.name,
      };

      const nextSections = [
        ...sections.slice(0, sectionIndex + 1),
        nextSection,
        ...sections.slice(sectionIndex + 1),
      ];

      setSelectedId(nextId);

      const nextCode = replaceSections(
        value,
        nextSections.map(s => s.code),
      );

      _onChange?.(nextCode);
      setCode(nextCode);
    }
  };

  const onSelect = (id: string) => {
    setSelectedId(prev => (prev === id ? null : id));
  };

  const onChange = (next: Partial<Section>) => {
    const nextSections = sections.map(s =>
      s.id === next.id ? { ...s, ...next } : s,
    );

    const nextCode = replaceSections(
      value,
      nextSections.map(s => s.code),
    );

    _onChange?.(nextCode);
    setCode(nextCode);
  };

  // Reads only the extracted `code` local, not `selectedItem`, so the
  // compiler can verify this dependency array actually matches what the
  // body reads — matches Panel's own former version of this same logic,
  // now shared here so both the built-in Panel and a custom renderPanel
  // get the same extraction/update pipeline instead of each needing it.
  const selectedCode = selectedItem?.code;
  const { fields, updatedCode, parseError } = useMemo(() => {
    if (!selectedCode) {
      return {
        fields: [] as DataAttrNode[],
        updatedCode: '',
        parseError: false,
      };
    }

    try {
      const updated = fillIds(selectedCode);
      const allNodes = extract(updated);
      const filtered = allNodes.filter(node => node.tagName !== 'section');

      return {
        fields: filtered,
        updatedCode: updated !== selectedCode ? updated : selectedCode,
        parseError: false,
      };
    } catch (e) {
      console.warn('⚠️ Parsing error', e);
      return {
        fields: [] as DataAttrNode[],
        updatedCode: '',
        parseError: true,
      };
    }
  }, [selectedCode]);

  useEffect(() => {
    if (parseError) {
      Toast.error('Failed to parse this section', {
        description: 'Check the console for details.',
      });
    }
  }, [parseError]);

  const onFieldChange = ({
    id,
    label,
    property,
    value: fieldValue,
  }: {
    id: string;
    label: string;
    property: string;
    value: string;
  }) => {
    const result = update(updatedCode, id, label, fieldValue, property);

    if (!result.success) {
      Toast.error('Failed to update this field', {
        description: 'Check the console for details.',
      });
      return;
    }

    if (selectedItem) {
      onChange({ ...selectedItem, code: result.code });
    }
  };

  // Flattens the extracted `fields` (one DataAttrNode per element) down to
  // one PanelBinding per bound property — the same walk the built-in
  // FieldEditor/Node does internally (data-id + parsed data-binding +
  // current value), but handed to a custom renderPanel as plain data so it
  // can render its own controls. Kept in a useMemo keyed on `fields` alone;
  // `onFieldChange` closes over `updatedCode`/`selectedItem` but is stable
  // enough per render, and rebuilding on every render would defeat the memo
  // guarding renderPanel's children.
  const bindings = useMemo<PanelBinding[]>(() => {
    return fields.flatMap(node => {
      const dataId = node.dataAttributes.find(a => a.name === 'data-id')?.value;
      const bindingAttr = node.dataAttributes.find(
        a => a.name === 'data-binding',
      )?.value;

      if (!dataId || !bindingAttr) {
        return [];
      }

      const parsed = node.bindings ?? parseBinding(bindingAttr);

      return parsed.map(binding => ({
        id: dataId,
        label: binding.label,
        property: binding.property,
        type: binding.type,
        options: binding.options,
        render: binding.render,
        min: binding.min,
        max: binding.max,
        pattern: binding.pattern,
        required: binding.required,
        value: getCurrentValue(node, binding.property),
        onChange: (value: string) =>
          onFieldChange({
            id: dataId,
            label: binding.label,
            property: binding.property,
            value,
          }),
      }));
    });
    // onFieldChange is intentionally omitted — it's recreated every render
    // but only ever called from a user event, so closing over the latest
    // one via the render that produced these bindings is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  useEffect(() => {
    if (frame?.scripts?.length) {
      preloadScripts(frame.scripts);
    }
  }, [frame?.scripts]);

  const renderPaletteItems = (
    onAdd: (item: Section) => void,
    forMobileDrawer = false,
  ) => {
    const paletteItems = items?.length ? items : DRAGGABLE_ITEMS;

    if (renderPalette) {
      return renderPalette({
        items: paletteItems,
        onAdd,
        DraggableItem,
        isMobile: forMobileDrawer,
      });
    }

    return (
      <Space orientation="vertical" align="start">
        {paletteItems.map(item => (
          <DefaultDraggableItem
            key={item.id}
            item={item}
            onAdd={onAdd}
            tapToAdd={forMobileDrawer}
          />
        ))}
      </Space>
    );
  };

  const renderPanelContent = () => {
    const selectedIndex = sections.findIndex(s => s.id === selectedId);
    const canMoveUp = selectedIndex > 0;
    const canMoveDown =
      selectedIndex >= 0 && selectedIndex < sections.length - 1;

    if (renderPanel) {
      return renderPanel({
        item: selectedItem,
        onChange,
        onDelete,
        onMoveUp: () => moveSection(selectedId, 'up'),
        onMoveDown: () => moveSection(selectedId, 'down'),
        canMoveUp,
        canMoveDown,
        bindings,
      });
    }

    return (
      <Panel
        item={selectedItem}
        onDelete={onDelete}
        onMoveUp={() => moveSection(selectedId, 'up')}
        onMoveDown={() => moveSection(selectedId, 'down')}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        fields={fields}
        onFieldChange={onFieldChange}
      />
    );
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
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
            'relative flex w-full',
            className,
            //
          )}
          {...restProps}
        >
          <div className="hidden w-1/5 overflow-y-auto md:block">
            <div className="h-full bg-gray-50 p-4">
              {renderPaletteItems(addItem)}
            </div>
          </div>
          <div
            className={cn(
              'relative',
              'h-full w-full md:w-3/5',
              'overflow-y-auto',
              //
            )}
            data-frame-container
            style={{
              isolation: 'isolate',
              contain: 'layout style',
              transform: 'translateZ(0)',
            }}
          >
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
          </div>
          <div className="hidden w-1/5 md:block">{renderPanelContent()}</div>
          <Button
            type="primary"
            shape="circle"
            icon={<LayoutGrid />}
            aria-label="Components"
            className="fixed right-4 bottom-4 z-20 md:hidden"
            onClick={() => setMobilePaletteOpen(true)}
          />
          <Drawer
            open={isMobile && mobilePaletteOpen}
            onClose={() => setMobilePaletteOpen(false)}
            direction="bottom"
            size="large"
            title="Components"
          >
            {renderPaletteItems(item => {
              addItem(item);
              setMobilePaletteOpen(false);
            }, true)}
          </Drawer>
          <Drawer
            open={isMobile && Boolean(selectedId)}
            onClose={() => setSelectedId(null)}
            direction="bottom"
            size="large"
            title="Properties"
          >
            {renderPanelContent()}
          </Drawer>
        </div>
        <DragOverlay>
          <Overlay
            sections={sections}
            renderProps={{
              fullCode: value,
              modules,
              frame,
              dynamicTailwind,
              ...props,
            }}
          />
        </DragOverlay>
      </DndContext>
    </>
  );
};

export default Dnd;
