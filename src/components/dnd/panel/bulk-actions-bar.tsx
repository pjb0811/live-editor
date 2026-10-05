import { Button } from '@jbpark/ui-kit';
import { ArrowDown, ArrowUp, Copy, X } from 'lucide-react';

import { useLiveMessages } from '~/components/context/messages';

interface BulkActionsBarProps {
  count: number;
  disabled?: boolean;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onClear: () => void;
}

const BulkActionsBar = ({
  count,
  disabled = false,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
  onClear,
}: BulkActionsBarProps) => {
  const messages = useLiveMessages();

  if (count === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-between rounded border
        border-blue-200 bg-blue-50 p-2"
    >
      <div className="text-xs font-medium text-blue-700">
        {messages.selection.count(count)}
      </div>
      <div className="flex items-center space-x-1">
        <Button
          size="small"
          icon={<Copy />}
          title={messages.selection.duplicate}
          disabled={disabled}
          onClick={onDuplicate}
        />
        <Button
          size="small"
          icon={<ArrowUp />}
          title={messages.selection.moveUp}
          disabled={disabled}
          onClick={onMoveUp}
        />
        <Button
          size="small"
          icon={<ArrowDown />}
          title={messages.selection.moveDown}
          disabled={disabled}
          onClick={onMoveDown}
        />
        <Button
          danger
          size="small"
          icon={<X />}
          title={messages.selection.delete}
          disabled={disabled}
          onClick={onDelete}
        />
        <Button size="small" onClick={onClear}>
          {messages.selection.clear}
        </Button>
      </div>
    </div>
  );
};

export default BulkActionsBar;
