import { useDroppable } from '@dnd-kit/core';

import { useLiveMessages } from '~/components/context/messages';
import { cn } from '~/utils/cn';

import styles from './canvas.module.css';

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
        styles.dropArea,
        shouldHighlight && styles.dropAreaOver,
        className,
      )}
    >
      {children}
      {isPaletteSectionDragging && (
        <div
          ref={setBottomRef}
          className={cn(
            styles.dropBottom,
            shouldHighlightBottom && styles.dropBottomOver,
          )}
        >
          {shouldHighlightBottom
            ? messages.canvas.dropHere
            : messages.canvas.dropAtBottom}
        </div>
      )}
    </div>
  );
};

export default Droppable;
