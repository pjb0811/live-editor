import { useEffect, useState } from 'react';

import {
  DndContext,
  PointerSensor,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { v4 as uuidv4 } from 'uuid';

import { DEFAULT_TEMPLATE } from '~/enums';
import { extractSections, replaceSections } from '~/utils';

import { usePreview } from '../Context/states';
import Draggable, { DRAGGABLE_ITEMS } from './Draggable';
import Droppable from './Droppable';
import Renderer from './Renderer';
import Sortable from './Sortable';

export interface Props {
  value?: string;
  props: Record<string, unknown>;
  scripts?: string[];
  onChange?: (value: string) => void;
}

const Dnd = ({
  value = DEFAULT_TEMPLATE,
  props,
  scripts = [],
  onChange: _onChange,
}: Props) => {
  const [sections, setSections] = useState<Dnd.Section[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { setCode } = usePreview();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const onDragStart = (_e: DragStartEvent) => {};

  const onDragOver = (_e: DragOverEvent) => {};

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      return;
    }

    // 새로운 아이템을 드롭 영역에 추가
    if (active.data.current?.type === 'new-item') {
      const newItem = active.data.current.item;
      const newSection = {
        id: uuidv4(),
        name: newItem.name,
        code: newItem.code,
      };

      let nextSections: typeof sections;
      const newSelectedId = newSection.id;

      // 드롭 위치에 따라 삽입 위치 결정
      if (over.id === 'sortable-area') {
        // 빈 공간에 드롭한 경우 - 맨 끝에 추가
        nextSections = [...sections, newSection];
      } else {
        // 기존 섹션 위에 드롭한 경우 - 해당 섹션 위에 삽입
        const overIndex = sections.findIndex(s => s.id === over.id);
        if (overIndex >= 0) {
          nextSections = [
            ...sections.slice(0, overIndex),
            newSection,
            ...sections.slice(overIndex),
          ];
        } else {
          // over.id가 섹션이 아닌 경우 맨 끝에 추가
          nextSections = [...sections, newSection];
        }
      }

      setSections(nextSections);
      setSelectedId(newSelectedId);

      const nextCode = replaceSections(
        value,
        nextSections.map(s => s.code),
      );

      _onChange?.(nextCode);
      setCode(nextCode);
      return;
    }

    // 기존 섹션들 간의 재정렬
    if (active.id !== over.id && sections.some(s => s.id === active.id)) {
      const prevIndex = sections.findIndex(s => s.id === active.id);
      const nextIndex = sections.findIndex(s => s.id === over.id);

      if (prevIndex >= 0 && nextIndex >= 0) {
        const nextSections = arrayMove(sections, prevIndex, nextIndex);
        setSections(nextSections);

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
    setSections(nextSections);
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
        code: sectionToCopy.code,
        name: sectionToCopy.name,
      };

      const nextSections = [
        ...sections.slice(0, sectionIndex + 1),
        nextSection,
        ...sections.slice(sectionIndex + 1),
      ];

      setSections(nextSections);
      setSelectedId(nextId);

      const nextCode = replaceSections(
        value,
        nextSections.map(s => s.code),
      );

      _onChange?.(nextCode);
      setCode(nextCode);
    }
  };

  useEffect(() => {
    setSections(prev => {
      if (prev.length) {
        return prev;
      }
      return extractSections(value);
    });
  }, [value]);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex w-full">
          <div className="w-1/5">
            <div className="h-full bg-gray-50 p-4">
              <h3 className="mb-4 text-lg font-semibold">
                컴포넌트 라이브러리
              </h3>
              <div className="space-y-2">
                {DRAGGABLE_ITEMS.map(item => (
                  <Draggable key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>
          <div className="w-3/5">
            <Droppable>
              {!sections.length ? (
                <div
                  className="flex h-full items-center justify-center
                    text-gray-500"
                >
                  <div className="text-center">
                    <p className="mb-2 text-lg">섹션이 없습니다</p>
                    <p className="text-sm">
                      왼쪽에서 컴포넌트를 드래그해서 추가하세요
                    </p>
                  </div>
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
                      selected={selectedId === section.id}
                      onClick={() => {
                        setSelectedId(
                          selectedId === section.id ? null : section.id,
                        );
                      }}
                      onDelete={onDelete}
                      onCopy={onCopy}
                    >
                      <Renderer code={section.code} {...props} />
                    </Sortable>
                  ))}
                </SortableContext>
              )}
            </Droppable>
          </div>
          <div className="w-1/5"></div>
        </div>
      </DndContext>
      {scripts.map((src, index) => (
        <script key={index} src={src} async />
      ))}
    </>
  );
};

export default Dnd;
