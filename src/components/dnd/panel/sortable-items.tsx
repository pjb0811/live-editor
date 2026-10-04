import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';

import {
  type LiveMessages,
  useLiveMessages,
} from '~/components/context/messages';
import { cn } from '~/utils/cn';

import type { DndItemsItem } from './use-dnd-items';

// The default announcements would read out the items' generated ids.
const label = (
  messages: LiveMessages,
  items: DndItemsItem[],
  id: string | number,
) => {
  const index = items.findIndex(item => item.id === id);

  // Every id dnd-kit reports is one of `items`; the id itself is only a
  // last resort.
  return index >= 0 ? messages.items.item(index + 1) : String(id);
};

// Drag sorting for the built-in Items editor (#436). It has a context of its
// own, so a drag here never reaches the canvas's section sorting. Moves go
// through `actions.move`, the same edit the up/down buttons make.
//
// A mouse drag starts after a few pixels of movement. A touch drag starts
// after a long press, so a short tap still scrolls the panel. The handle is
// a button, so the keyboard can pick an item up with Space or Enter and move
// it with the arrow keys.
export const SortableItems = ({
  items,
  disabled,
  onMove,
  children,
}: {
  items: DndItemsItem[];
  disabled?: boolean;
  onMove: (item: DndItemsItem, toIndex: number) => void;
  children: (item: DndItemsItem) => React.ReactNode;
}) => {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const from = items.find(item => item.id === active.id);
    const to = items.find(item => item.id === over?.id);

    if (from && to && from !== to) {
      onMove(from, to.index);
    }
  };

  const messages = useLiveMessages();
  const { announcements: say } = messages;
  const name = (id: string | number) => label(messages, items, id);

  const announcements: Announcements = {
    onDragStart: ({ active }) => say.pickedUp(name(active.id)),
    onDragOver: ({ active, over }) =>
      over ? say.itemOver(name(active.id), name(over.id)) : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? say.itemMoved(name(active.id), name(over.id))
        : say.dropped(name(active.id)),
    onDragCancel: ({ active }) => say.cancelled(name(active.id)),
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{ announcements }}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map(item => item.id)}
        strategy={verticalListSortingStrategy}
        disabled={disabled}
      >
        <div className="space-y-4">{items.map(children)}</div>
      </SortableContext>
    </DndContext>
  );
};

// One item in the Items editor: a header with a drag handle, the selection
// checkbox and a toggle that shows or hides the item's fields.
export const ItemCard = ({
  id,
  title,
  disabled,
  expanded,
  onToggle,
  checkbox,
  controls,
  className,
  children,
}: {
  id: string;
  title: string;
  disabled?: boolean;
  expanded: boolean;
  onToggle: () => void;
  checkbox: React.ReactNode;
  controls: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) => {
  const messages = useLiveMessages();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(className, isDragging && 'relative z-10 shadow-md')}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={messages.items.reorder(title)}
            disabled={disabled}
            className="cursor-grab rounded p-0.5 text-gray-400
              hover:text-gray-700 disabled:cursor-not-allowed
              disabled:opacity-40"
          >
            <GripVertical size={14} />
          </button>
          {checkbox}
          <button
            type="button"
            aria-expanded={expanded}
            onClick={onToggle}
            className="inline-flex items-center space-x-1 rounded px-1 text-xs
              font-medium"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>{title}</span>
          </button>
        </div>
        {controls}
      </div>
      {expanded && children}
    </div>
  );
};
