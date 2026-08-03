import { useDraggable } from '@dnd-kit/core';
import { Card } from '@jbpark/ui-kit';

import type { DRAGGABLE_ITEMS } from '~/constants';
import { cn } from '~/utils';

type Item = (typeof DRAGGABLE_ITEMS)[0];

const Draggable = ({
  item,
  onAdd,
}: {
  item: Item;
  onAdd?: (item: Item) => void;
}) => {
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
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'cursor-grab',
        'outline-none',
        'hover:border-blue-300 hover:shadow-md',
        isDragging && 'opacity-50',
      )}
      onDoubleClick={() => onAdd?.(item)}
    >
      {item.name}
    </Card>
  );
};

export default Draggable;
