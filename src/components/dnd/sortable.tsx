import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Space } from '@jbpark/ui-kit';
import { ChevronDown, ChevronUp, Copy, Trash } from 'lucide-react';

import { cn } from '~/utils/cn';

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
  // Registers the focusable wrapper, so the canvas can move focus to it.
  nodeRef?: (node: HTMLElement | null) => void;
  // Arrow keys and Home/End on a focused section, outside a drag (#435).
  onNavigate?: (to: SectionNavigation) => void;
  // Delete or Backspace on a focused section (#435).
  onDeleteKey?: () => void;
  // The element picker is on (#432): the section can't be dragged, and the
  // pointer over it reports positions instead of selecting it.
  inspecting?: boolean;
  onInspectMove?: (
    section: HTMLElement,
    overlay: Element,
    x: number,
    y: number,
  ) => void;
  onInspectPick?: (
    section: HTMLElement,
    overlay: Element,
    x: number,
    y: number,
  ) => void;
  onInspectLeave?: () => void;
}

export type SectionNavigation = 'previous' | 'next' | 'first' | 'last';

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
  onDelete: _onDelete,
  onCopy: _onCopy,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  nodeRef,
  onNavigate,
  onDeleteKey,
  inspecting = false,
  onInspectMove,
  onInspectPick,
  onInspectLeave,
}: Props) => {
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: inspecting ? 'crosshair' : 'grab',
  };

  const isNewItemOver = isOver && active?.data.current?.type === 'new-item';

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

    if (to && onNavigate) {
      // Otherwise the arrow keys also scroll the canvas.
      e.preventDefault();
      onNavigate(to);

      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && onDeleteKey) {
      e.preventDefault();
      onDeleteKey();
    }
  };

  // The same element is the activator, so Space on a toolbar button presses
  // that button instead of picking the section up.
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    setActivatorNodeRef(node);
    nodeRef?.(node);
  };

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    _onDelete?.(id);
  };

  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    _onCopy?.(id);
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
        isNewItemOver && 'border-t-4 border-t-green-500',
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
                onInspectMove?.(
                  e.currentTarget.parentElement!,
                  e.currentTarget,
                  e.clientX,
                  e.clientY,
                )
            : undefined
        }
        onPointerLeave={inspecting ? onInspectLeave : undefined}
        onClick={
          inspecting
            ? e => {
                // The pick selects the section itself.
                e.stopPropagation();
                onInspectPick?.(
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
              aria-label="Move section up"
            />
          )}
          {onMoveDown && (
            <Button
              icon={<ChevronDown />}
              disabled={!canMoveDown}
              onClick={press(onMoveDown)}
              aria-label="Move section down"
            />
          )}
          <Button
            icon={<Copy />}
            onClick={onCopy}
            aria-label="Duplicate section"
          />
          <Button
            danger
            icon={<Trash />}
            onClick={onDelete}
            aria-label="Delete section"
          />
        </Space>
      )}
    </div>
  );
};

export default Sortable;
