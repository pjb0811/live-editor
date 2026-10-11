import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Space } from '@jbpark/ui-kit';
import { ChevronDown, ChevronUp, Copy, Trash } from 'lucide-react';

import { useLiveMessages } from '~/components/context/messages';
import { cn } from '~/utils/cn';

import { paletteSectionOf } from '../palette/palette-drag';
import { type SectionNavigation, useSectionHandlers } from './section-handlers';

interface Props {
  id: string;
  name?: string;
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onDelete?: (id: string) => void;
  onCopy?: (id: string) => void;
  // The move buttons on the selected section, the same move as the panel's
  // (#505). Each is disabled where the section can't go further.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

const NAVIGATION_KEYS: Record<string, SectionNavigation> = {
  ArrowUp: 'previous',
  ArrowDown: 'next',
  Home: 'first',
  End: 'last',
};

const Sortable = ({
  id,
  children,
  selected,
  onClick,
  onDelete,
  onCopy,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: Props) => {
  // The picker and keyboard handlers, or `null` in the drag overlay.
  const handlers = useSectionHandlers();
  const inspecting = handlers?.inspecting ?? false;

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    active,
  } = useSortable({ id, disabled: inspecting });
  const messages = useLiveMessages();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: inspecting ? 'crosshair' : 'grab',
  };

  const isPaletteSectionOver = isOver && !!paletteSectionOf(active?.data);

  // The wrapper is a `role="button"`, so Enter selects it the way a click
  // does. Only when the key lands on the wrapper itself, not on its copy and
  // delete buttons, and not while a drag is on (Enter drops one then) (#435).
  //
  // The same rule covers the other keys handled here. Keys pressed inside a
  // section's own inputs never count: those sit in the section's frame, or
  // retarget to its shadow host, so the event target isn't the wrapper.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    listeners?.onKeyDown?.(e);

    if (e.target !== e.currentTarget || active || e.defaultPrevented) {
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      onClick?.();

      return;
    }

    const to = NAVIGATION_KEYS[e.key];

    if (to && handlers) {
      // Otherwise the arrow keys also scroll the canvas.
      e.preventDefault();
      handlers.onNavigate(id, to);

      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && handlers) {
      e.preventDefault();
      handlers.onDeleteKey(id);
    }
  };

  // The same element is the activator, so Space on a toolbar button presses
  // that button instead of picking the section up.
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    setActivatorNodeRef(node);
    handlers?.nodeRef(id)(node);
  };

  // Stops the click from reaching the wrapper, which would select it again.
  const press = (action?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action?.();
  };

  return (
    <div
      ref={setRefs}
      style={style}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={onClick}
      className={cn(
        'relative',
        selected && 'z-10 outline-2 outline-offset-2 outline-blue-500',
        isPaletteSectionOver && 'border-t-4 border-t-green-500',
        //
      )}
    >
      <div
        className={cn(
          'absolute inset-0 z-50',
          //
        )}
        onPointerMove={
          inspecting
            ? e =>
                handlers?.onInspectMove(
                  e.currentTarget.parentElement!,
                  e.currentTarget,
                  e.clientX,
                  e.clientY,
                )
            : undefined
        }
        onPointerLeave={inspecting ? handlers?.onInspectLeave : undefined}
        onClick={
          inspecting
            ? e => {
                // The pick selects the section itself.
                e.stopPropagation();
                handlers?.onInspectPick(
                  id,
                  e.currentTarget.parentElement!,
                  e.currentTarget,
                  e.clientX,
                  e.clientY,
                );
              }
            : undefined
        }
      />
      {children}
      {selected && (
        <Space
          className={cn(
            'absolute top-1 right-1 z-60',
            //
          )}
        >
          {onMoveUp && (
            <Button
              icon={<ChevronUp />}
              disabled={!canMoveUp}
              onClick={press(onMoveUp)}
              aria-label={messages.section.moveUp}
            />
          )}
          {onMoveDown && (
            <Button
              icon={<ChevronDown />}
              disabled={!canMoveDown}
              onClick={press(onMoveDown)}
              aria-label={messages.section.moveDown}
            />
          )}
          <Button
            icon={<Copy />}
            onClick={press(() => onCopy?.(id))}
            aria-label={messages.section.duplicate}
          />
          <Button
            danger
            icon={<Trash />}
            onClick={press(() => onDelete?.(id))}
            aria-label={messages.section.delete}
          />
        </Space>
      )}
    </div>
  );
};

export default Sortable;
