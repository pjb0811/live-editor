import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Space } from '@jbpark/ui-kit';
import { Copy, Trash } from 'lucide-react';

import { cn } from '~/utils/cn';

interface Props {
  id: string;
  name?: string;
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onDelete?: (id: string) => void;
  onCopy?: (id: string) => void;
}

const Sortable = ({
  id,
  children,
  selected,
  onClick,
  onDelete: _onDelete,
  onCopy: _onCopy,
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
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  const isNewItemOver = isOver && active?.data.current?.type === 'new-item';

  // The wrapper is a `role="button"`, so Enter selects it the way a click
  // does. Only when the key lands on the wrapper itself, not on its copy and
  // delete buttons, and not while a drag is on (Enter drops one then) (#435).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    listeners?.onKeyDown?.(e);

    if (
      e.key === 'Enter' &&
      e.target === e.currentTarget &&
      !active &&
      !e.defaultPrevented
    ) {
      e.preventDefault();
      onClick?.();
    }
  };

  // The same element is the activator, so Space on the copy or delete button
  // presses that button instead of picking the section up.
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    setActivatorNodeRef(node);
  };

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    _onDelete?.(id);
  };

  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    _onCopy?.(id);
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
      />
      {children}
      {selected && (
        <Space
          className={cn(
            'absolute top-1 right-1 z-60',
            //
          )}
        >
          <Button icon={<Copy />} onClick={onCopy} />
          <Button danger icon={<Trash />} onClick={onDelete} />
        </Space>
      )}
    </div>
  );
};

export default Sortable;
