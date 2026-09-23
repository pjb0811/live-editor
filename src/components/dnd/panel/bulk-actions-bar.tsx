import { Button } from '@jbpark/ui-kit';
import { ArrowDown, ArrowUp, Copy, X } from 'lucide-react';

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
  if (count === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-between rounded border
        border-blue-200 bg-blue-50 p-2"
    >
      <div className="text-xs font-medium text-blue-700">{count} selected</div>
      <div className="flex items-center space-x-1">
        <Button
          size="small"
          icon={<Copy />}
          title="Duplicate selected"
          disabled={disabled}
          onClick={onDuplicate}
        />
        <Button
          size="small"
          icon={<ArrowUp />}
          title="Move selected up"
          disabled={disabled}
          onClick={onMoveUp}
        />
        <Button
          size="small"
          icon={<ArrowDown />}
          title="Move selected down"
          disabled={disabled}
          onClick={onMoveDown}
        />
        <Button
          danger
          size="small"
          icon={<X />}
          title="Delete selected"
          disabled={disabled}
          onClick={onDelete}
        />
        <Button size="small" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
};

export default BulkActionsBar;
