import { useDraggable } from '@dnd-kit/core';

import type { DRAGGABLE_ITEMS } from '~/enums';
import { cn } from '~/utils';

const Draggable = ({ item }: { item: (typeof DRAGGABLE_ITEMS)[0] }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
      data: { type: 'new-item', item },
    });

  const style = transform
    ? {
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'mb-2 cursor-grab rounded-lg border border-gray-200 p-4',
        'bg-white shadow-sm transition-all',
        'outline-none',
        'hover:border-blue-300 hover:shadow-md',
        isDragging && 'opacity-50',
      )}
    >
      <div className="font-medium text-gray-800">{item.name}</div>
    </div>
  );
};

export default Draggable;
