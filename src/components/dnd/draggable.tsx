import { useDraggable } from '@dnd-kit/core';
import { Card } from '@jbpark/ui-kit';

import type { Section } from '~/types';
import { cn } from '~/utils';

export interface DraggableItemDragState {
  ref: (node: HTMLElement | null) => void;
  dragProps: React.HTMLAttributes<HTMLElement>;
  isDragging: boolean;
}

export interface DraggableItemProps {
  item: Section;
  children: (drag: DraggableItemDragState) => React.ReactNode;
}

// Owns the dnd-kit wiring (useDraggable + the `type: 'new-item'` data shape
// Dnd's onDragEnd expects) so a custom renderPalette only has to decide how
// an item *looks*, not how dragging itself works. Exported as
// Dnd.DraggableItem for that purpose; also used internally for the default
// palette rendering, so both paths share the exact same drag wiring.
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

// The built-in card look, shared by the default (non-custom) palette
// rendering and the drag overlay's floating preview — both rendered a plain
// `<Draggable>` before this became a children-render-prop component.
export interface DefaultDraggableItemProps {
  item: Section;
  onAdd?: (item: Section) => void;
  // Double-click is the desktop convenience shortcut alongside drag — a
  // single click there would fire on every aborted/failed drag attempt.
  // On mobile there's nowhere to drag *to* (the palette lives in a Drawer
  // stacked over the canvas), so a tap can't be a failed drag, and
  // double-tap-to-dblclick synthesis from touch is unreliable anyway
  // (iOS Safari inconsistently fires it, and it can compete with the
  // browser's native double-tap-to-zoom gesture). Tapping just adds there.
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
          'outline-none',
          'hover:border-blue-300 hover:shadow-md',
          isDragging && 'opacity-50',
        )}
        onClick={tapToAdd && onAdd ? () => onAdd(item) : undefined}
        onDoubleClick={onAdd ? () => onAdd(item) : undefined}
      >
        {item.name}
      </Card>
    )}
  </DraggableItem>
);

export default DraggableItem;
