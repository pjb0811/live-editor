import { useDroppable } from '@dnd-kit/core';

import { cn } from '~/utils';

const Droppable = ({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) => {
  const { setNodeRef, isOver, active } = useDroppable({
    id: 'sortable-area',
  });

  const {
    setNodeRef: setBottomRef,
    isOver: isBottomOver,
    active: bottomActive,
  } = useDroppable({
    id: 'sortable-area-bottom',
  });

  const isNewItemDragging = active?.data.current?.type === 'new-item';
  const shouldHighlight = isOver && isNewItemDragging;

  const isBottomNewItemDragging =
    bottomActive?.data.current?.type === 'new-item';
  const shouldHighlightBottom = isBottomOver && isBottomNewItemDragging;

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
      <div
        ref={setBottomRef}
        className={cn(
          'min-h-32',
          'rounded-lg border-2 border-dashed',
          'transition-all duration-200',
          'pt-4',
          'flex items-center justify-center',
          shouldHighlightBottom
            ? 'border-blue-400 bg-blue-100'
            : 'border-transparent',
        )}
      >
        {isBottomNewItemDragging && (
          <p className="text-sm text-gray-500">여기로 드래그하여 하단에 추가</p>
        )}
      </div>
    </div>
  );
};

export default Droppable;
