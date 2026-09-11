import { Children, useEffect, useMemo, useState } from 'react';

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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Space, Toast, Typography } from '@jbpark/ui-kit';
import { useResponsiveSize } from '@jbpark/use-hooks';

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
  getStructuredValue,
  parseBinding,
  update,
} from '~/utils/ast';
import type { UpdateFailure } from '~/utils/ast';

import { DEFAULT_TEMPLATE } from '../../constants';
import { cn, preloadScripts } from '../../utils';
import { usePreview } from '../context/states';
import { type FrameProps } from '../frame';
import Droppable from './droppable';
import Layout from './layout';
import { DndRegionContext } from './layout-context';
import Overlay from './overlay';
import Renderer from './renderer';
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
    case 'parse-error':
      return {
        title: `Failed to update "${label}"`,
        description: 'Check the console for details.',
      };
    default:
      return { title: `Failed to update "${label}"` };
  }
};

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

// The node-level commit callback's shape, named because it's part of the
// public surface in two places (`DndPanel`, `Field`) and was previously
// spelled out inline in each — see #308.
export interface PanelNodeChange {
  (params: {
    id: string;
    label: string;
    property: string;
    value: unknown;
  }): void;
}

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
}

// One editable data-binding, flattened out of the selected section for a
// custom panel. Exposes just what a consumer needs to render its own
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
  // Presentation, as opposed to `type`'s data kind — an open string, not a
  // closed enum, since a custom panel can declare any widget it wants
  // (e.g. `'slider'`) and switch on it itself. The built-in panel
  // only recognizes `'icon-picker'`/`'asset-picker'`; anything else falls
  // back to the `type`-appropriate default control. See #236.
  widget?: string;
  // Present when the binding defines a fixed option set (render a <select>).
  options?: BindingOption[];
  // Present for `object`/`array` bindings whose nested keys/items declare
  // their own types — the same map the built-in panel uses to type each
  // nested field instead of falling back to a plain string input.
  render?: BindingRenderMap;
  // Constraints declared on the binding. `min`/`max` compare against the
  // real number `value` delivers for `type: 'number'` bindings (see
  // `validateBindingValue`).
  min?: number;
  max?: number;
  pattern?: string;
  required?: boolean;
  // Consumer-defined keys carried straight through from the authored
  // data-binding — namespaced instead of spread onto PanelBinding so they
  // can't collide with a future first-class field. Absent when nothing
  // extra was authored. See #234.
  meta?: Record<string, unknown>;
  // Current value as its real JS type — a number for `type: 'number'`, a
  // boolean for `type: 'boolean'`, an object/array for `object`/`array`,
  // a string otherwise. Switch on this without re-parsing. See #238.
  value: unknown;
  // The exact source text behind `value`, for cases that can't round-trip
  // through a JS value — `jsx`/`richtext` bindings, or an attribute whose
  // source is an expression you want to edit as text.
  rawValue: string;
  // Commit a new value through the same AST-update pipeline the built-in
  // panel uses (including the error Toast on a bad edit). Pass the value as
  // its real type; it's serialized once, at the AST boundary, where the
  // declared `type` is known — so no string quoting/guessing on your side.
  onChange: (value: unknown) => void;
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
  children,
  ...restProps
}: Props) => {
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  const { breakpoint } = useResponsiveSize();
  const isMobile = breakpoint.current === 'xs' || breakpoint.current === 'sm';

  // Read-only here — `useSectionDocument` below owns `setCode` (the commit
  // side). `code` is still needed locally: it feeds `value`'s fallback
  // chain just below, and `value` itself is read again further down for
  // the drag overlay's `fullCode` — not something `useSectionDocument`
  // exposes back out.
  const { code } = usePreview();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
  );

  // Uncontrolled usage (`<Live.Dnd />` with no `value`) used to read
  // nothing but DEFAULT_TEMPLATE forever: every edit committed through
  // useSectionDocument writes into PreviewContext, but this component
  // never read `code` back — so the section a reader just dragged in
  // vanished on the very next render. `Client` (preview/client.tsx)
  // already resolves the same dual-source situation with `_code || code`;
  // mirrored here, with DEFAULT_TEMPLATE kept only as the final fallback
  // for the case neither is set (fresh, empty context) — see #244.
  const value = _value || code || DEFAULT_TEMPLATE;

  const {
    sections,
    previews,
    selectedId,
    selectedItem,
    selectedIndex,
    select,
    clearSelection,
    add: addItem,
    remove: onDelete,
    copy: onCopy,
    move: moveSection,
    reorder,
    patch,
  } = useSectionDocument(value, _onChange);

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
    value: unknown;
  }) => {
    const result = update(updatedCode, id, label, fieldValue, property);

    if (!result.success) {
      const { title, description } = describeUpdateFailure(
        result.failure,
        label,
      );
      Toast.error(title, description ? { description } : undefined);
      return;
    }

    if (selectedItem) {
      onChange({ ...selectedItem, code: result.code });
    }
  };

  // Flattens the extracted `fields` (one DataAttrNode per element) down to
  // one PanelBinding per bound property — the same walk the built-in
  // FieldEditor/Node does internally (data-id + parsed data-binding +
  // current value), but published through `useDndPanel()` as plain data so a
  // custom panel can render its own controls. Kept in a useMemo keyed on
  // `fields` alone; `onFieldChange` closes over `updatedCode`/`selectedItem`
  // but is stable enough per render, and rebuilding this array on every
  // render would re-render every panel consuming it.
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
        widget: binding.widget,
        options: binding.options,
        render: binding.render,
        min: binding.min,
        max: binding.max,
        pattern: binding.pattern,
        required: binding.required,
        meta: binding.meta,
        value: getStructuredValue(node, binding.property, binding.type),
        rawValue: getCurrentValue(node, binding.property),
        onChange: (value: unknown) =>
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
  };

  // Content only — the frame container that wraps this (`data-frame-container`
  // plus the containment styles) belongs to `Live.Dnd.Canvas`, so a custom
  // layout can't accidentally drop it while still placing the canvas.
  const canvas = (
    <>
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
              <Typography.Paragraph>No sections available</Typography.Paragraph>
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
    </>
  );

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
            'relative flex h-full w-full',
            className,
            //
          )}
          {...restProps}
        >
          {/* Not memoized: `palette`, `panel` and `canvas` are all rebuilt
              each render anyway, so a memo would only add a dependency list
              to keep in sync. */}
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
