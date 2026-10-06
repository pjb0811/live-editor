import { useDroppable } from '@dnd-kit/core';
import { Typography } from '@jbpark/ui-kit';

import { useLiveMessages } from '~/components/context/messages';
import { cn } from '~/utils/cn';

import { paletteSectionOf } from '../palette/palette-drag';

const Droppable = ({
  children,
  className,
}: React.ComponentPropsWithRef<'div'>) => {
  const { setNodeRef, isOver, active } = useDroppable({
    id: 'sortable-area',
  });

  const { setNodeRef: setBottomRef, isOver: isBottomOver } = useDroppable({
    id: 'sortable-area-bottom',
  });

  const isPaletteSectionDragging = !!paletteSectionOf(active?.data);
  const shouldHighlight = isOver && isPaletteSectionDragging;
  const shouldHighlightBottom = isBottomOver && isPaletteSectionDragging;
  const messages = useLiveMessages();

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
      {isPaletteSectionDragging && (
        <div
          ref={setBottomRef}
          className={cn(
            'mt-2 min-h-24',
            'rounded-lg border-2 border-dashed',
            'transition-all duration-200',
            'flex items-center justify-center',
            shouldHighlightBottom
              ? 'border-blue-400 bg-blue-100'
              : 'border-gray-300 bg-gray-50',
          )}
        >
          <Typography.Text className="text-sm text-gray-500">
            {shouldHighlightBottom
              ? messages.canvas.dropHere
              : messages.canvas.dropAtBottom}
          </Typography.Text>
        </div>
      )}
    </div>
  );
};

export default Droppable;
