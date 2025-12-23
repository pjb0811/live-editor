import { useDroppable } from '@dnd-kit/core';

import { cn } from '~/utils';

const Droppable = ({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) => {
  const { setNodeRef, isOver, active } = useDroppable({
    id: 'sortable-area',
  });

  const isNewItemDragging = active?.data.current?.type === 'new-item';
  const shouldHighlight = isOver && isNewItemDragging;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-full',
        'border-2 border-dashed p-1',
        shouldHighlight ? 'border-blue-300 bg-blue-50' : 'border-gray-200',
        className,
      )}
    >
      {children}
    </div>
  );
};

export default Droppable;
