import { useDroppable } from '@dnd-kit/core';

import { cn } from '~/utils';

const Droppable = ({ children }: { children: React.ReactNode }) => {
  const { setNodeRef, isOver, active } = useDroppable({
    id: 'sortable-area',
  });

  const isNewItemDragging = active?.data.current?.type === 'new-item';
  const shouldHighlight = isOver && isNewItemDragging;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'h-full min-h-[200px] border-2 border-dashed p-1',
        shouldHighlight ? 'border-blue-300 bg-blue-50' : 'border-gray-200',
      )}
    >
      {children}
    </div>
  );
};

export default Droppable;
