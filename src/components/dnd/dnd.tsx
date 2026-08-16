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
  type DataAttrNode,
  extract,
  fillIds,
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
import Panel, { FieldEditor } from './panel';
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
  // `item`'s editable data-binding fields, already extracted and ready to
  // render — one entry per element carrying a `data-binding` attribute,
  // filtered down to non-<section> descendants (mirrors what the built-in
  // Panel shows). Render each with FieldEditor (or your own UI reading
  // `.bindings`/`.dataAttributes`) and wire its onChange to onFieldChange,
  // which handles the underlying AST update — including showing an error
  // Toast on a bad edit — the same way the built-in Panel does.
  fields: DataAttrNode[];
  onFieldChange: (params: { id: string; label: string; value: string }) => void;
  FieldEditor: typeof FieldEditor;
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
    value: fieldValue,
  }: {
    id: string;
    label: string;
    value: string;
  }) => {
    const result = update(updatedCode, id, label, fieldValue);

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
        fields,
        onFieldChange,
        FieldEditor,
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
                      Drag a component from the left to add it
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
              ...props,
            }}
          />
        </DragOverlay>
      </DndContext>
    </>
  );
};

export default Dnd;
