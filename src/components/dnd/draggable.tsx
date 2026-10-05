import { useDraggable } from '@dnd-kit/core';
import { Card } from '@jbpark/ui-kit';

import type { Section } from '~/types';
import { cn } from '~/utils/cn';

export interface DraggableItemDragState {
  ref: (node: HTMLElement | null) => void;
  dragProps: React.HTMLAttributes<HTMLElement>;
  isDragging: boolean;
}

export interface DraggableItemProps {
  item: Section;
  children: (drag: DraggableItemDragState) => React.ReactNode;
}

// Makes a palette item draggable, with the `type: 'new-item'` data the
// canvas expects on drop. `Live.Dnd.DraggableItem`; the built-in palette
// uses it too.
const DraggableItem = ({ item, children }: DraggableItemProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { type: 'new-item', item },
  });

  return children({
    ref: setNodeRef,
    dragProps: { ...listeners, ...attributes },
    isDragging,
  });
};

// The built-in palette card, used by the palette and the drag overlay.
export interface DefaultDraggableItemProps {
  item: Section;
  onAdd?: (item: Section) => void;
  // Add on a single tap instead of a double-click. On desktop a click could
  // be a drag that didn't start, so a double-click adds. On mobile there's
  // nothing to drag onto behind the Drawer, and a double-tap doesn't reliably
  // fire `dblclick`, so a tap adds.
  tapToAdd?: boolean;
}

export const DefaultDraggableItem = ({
  item,
  onAdd,
  tapToAdd = false,
}: DefaultDraggableItemProps) => (
  <DraggableItem item={item}>
    {({ ref, dragProps, isDragging }) => (
      <Card
        ref={ref}
        style={{ opacity: isDragging ? 0.5 : 1 }}
        {...dragProps}
        className={cn(
          'cursor-grab',
          // A visible ring for keyboard focus only, instead of no outline at
          // all: the card is reachable with Tab (#435).
          'outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          'hover:border-blue-300 hover:shadow-md',
          isDragging && 'opacity-50',
        )}
        onClick={tapToAdd && onAdd ? () => onAdd(item) : undefined}
        onDoubleClick={onAdd ? () => onAdd(item) : undefined}
        // The card is a `role="button"`: Enter adds it, the keyboard
        // counterpart of the double-click above. Space stays with dnd-kit,
        // which picks the card up (#435).
        onKeyDown={event => {
          dragProps.onKeyDown?.(event);

          if (
            onAdd &&
            event.key === 'Enter' &&
            event.target === event.currentTarget &&
            !event.defaultPrevented
          ) {
            event.preventDefault();
            onAdd(item);
          }
        }}
      >
        {item.name}
      </Card>
    )}
  </DraggableItem>
);

export default DraggableItem;
