import { useDroppable } from '@dnd-kit/core';

import { useLiveMessages } from '~/components/context/messages';
import { cn } from '~/utils/cn';

import styles from './canvas.module.css';

import { paletteSectionOf } from '../palette/palette-drag';

interface DroppableProps {
  children?: React.ReactNode;
  className?: string;
  // The sections' width in CSS pixels, not counting the drop area's padding
  // and border. Unset fills the canvas.
  width?: number;
}

const Droppable = ({ children, className, width }: DroppableProps) => {
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
        width !== undefined && styles.dropAreaSized,
        className,
      )}
      style={
        width === undefined
          ? undefined
          : ({
              '--live-editor-canvas-width': `${width}px`,
            } as React.CSSProperties)
      }
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
