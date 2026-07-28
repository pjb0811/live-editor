import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Space } from '@jbpark/ui-kit';
import { Copy, Trash } from 'lucide-react';

import { cn } from '~/utils';

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
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
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
