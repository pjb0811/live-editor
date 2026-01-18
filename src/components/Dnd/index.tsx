import { useEffect, useMemo, useRef, useState } from 'react';

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
import { Space, Typography } from '@jbpark/ui-kit';
import { v4 as uuidv4 } from 'uuid';

import { DRAGGABLE_ITEMS } from '~/enums';
import type { Section } from '~/types';
import { replaceIds } from '~/utils/ast';

import { DEFAULT_TEMPLATE } from '../../enums';
import { cn, extractSections, replaceSections } from '../../utils';
import { usePreview } from '../Context/states';
import Draggable from './Draggable';
import Droppable from './Droppable';
import Overlay from './Overlay';
import Panel from './Panel';
import Renderer from './Renderer';
import Sortable from './Sortable';

export interface Props extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  value?: string;
  props: Record<string, unknown>;
  modules?: Record<string, unknown>;
  items?: Section[];
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
  value = DEFAULT_TEMPLATE,
  props,
  modules = {},
  onChange: _onChange,
  className,
  items = [],
  ...restProps
}: Props) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  const { setCode } = usePreview();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
  );

  const sections = useMemo(() => extractSections(value), [value]);

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
    setContainer(previewRef.current);
  }, []);

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
            'flex w-full',
            className,
            //
          )}
          {...restProps}
        >
          <div className="w-1/5 overflow-y-auto">
            <div className="h-full bg-gray-50 p-4">
              <Typography.Title className="mb-4 text-lg font-semibold">
                컴포넌트 라이브러리
              </Typography.Title>
              <Space orientation="vertical" align="start">
                {(items?.length ? items : DRAGGABLE_ITEMS).map(item => (
                  <Draggable key={item.id} item={item} />
                ))}
              </Space>
            </div>
          </div>
          <div
            className={cn(
              'relative',
              'h-full w-3/5',
              'overflow-y-auto',
              //
            )}
            ref={previewRef}
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
                    <Typography.Paragraph>섹션이 없습니다</Typography.Paragraph>
                    <Typography.Text>
                      왼쪽에서 컴포넌트를 드래그해서 추가하세요
                    </Typography.Text>
                  </Space>
                </div>
              ) : (
                <SortableContext
                  items={sections.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sections.map(section => (
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
                        fullCode={value}
                        code={section.code}
                        modules={modules}
                        container={container}
                        {...props}
                      />
                    </Sortable>
                  ))}
                </SortableContext>
              )}
            </Droppable>
          </div>
          <div className="w-1/5">
            <Panel
              item={sections.find(s => s.id === selectedId)}
              onChange={onChange}
            />
          </div>
        </div>
        <DragOverlay>
          <Overlay
            sections={sections}
            renderProps={{
              fullCode: value,
              modules,
              ...props,
            }}
          />
        </DragOverlay>
      </DndContext>
    </>
  );
};

export default Dnd;
