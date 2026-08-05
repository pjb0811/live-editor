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
import { Button, Drawer, Space, Typography } from '@jbpark/ui-kit';
import { useResponsiveSize } from '@jbpark/use-hooks';
import { LayoutGrid } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { DRAGGABLE_ITEMS } from '~/constants';
import type { Section } from '~/types';
import { replaceIds } from '~/utils/ast';

import { DEFAULT_TEMPLATE } from '../../constants';
import {
  cn,
  extractSections,
  generateSections,
  preloadScripts,
  replaceSections,
} from '../../utils';
import { usePreview } from '../context/states';
import { type FrameProps } from '../frame';
import Draggable from './draggable';
import Droppable from './droppable';
import Overlay from './overlay';
import Panel from './panel';
import Renderer from './renderer';
import Sortable from './sortable';

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
  const previews = useMemo(
    () =>
      generateSections(
        sections.map(s => s.code),
        value,
      ),
    [sections, value],
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

  useEffect(() => {
    if (frame?.scripts?.length) {
      preloadScripts(frame.scripts);
    }
  }, [frame?.scripts]);

  const renderPaletteItems = (
    onAdd: (item: (typeof DRAGGABLE_ITEMS)[0]) => void,
  ) => (
    <Space orientation="vertical" align="start">
      {(items?.length ? items : DRAGGABLE_ITEMS).map(item => (
        <Draggable key={item.id} item={item} onAdd={onAdd} />
      ))}
    </Space>
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
          <div className="hidden w-1/5 md:block">
            <Panel
              item={sections.find(s => s.id === selectedId)}
              onChange={onChange}
              onDelete={onDelete}
            />
          </div>
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
            })}
          </Drawer>
          <Drawer
            open={isMobile && Boolean(selectedId)}
            onClose={() => setSelectedId(null)}
            direction="bottom"
            size="large"
            title="Properties"
          >
            <Panel
              item={sections.find(s => s.id === selectedId)}
              onChange={onChange}
              onDelete={onDelete}
            />
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
