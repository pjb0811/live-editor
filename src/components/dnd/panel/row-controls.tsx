import { Button } from '@jbpark/ui-kit';
import { ArrowDown, ArrowUp, X } from 'lucide-react';

interface Props {
  // The row's position among `count` rows.
  index: number;
  count: number;
  labels: { moveUp: string; moveDown: string; delete: string };
  disabled?: boolean;
  deleteDisabled?: boolean;
  onMove: (toIndex: number) => void;
  onDelete: () => void;
}

// Move up, move down and delete for one Items or Children row.
const RowControls = ({
  index,
  count,
  labels,
  disabled = false,
  deleteDisabled = false,
  onMove,
  onDelete,
}: Props) => (
  <div className="flex space-x-1">
    <Button
      size="small"
      icon={<ArrowUp />}
      aria-label={labels.moveUp}
      disabled={disabled || index === 0}
      onClick={() => onMove(index - 1)}
    />
    <Button
      size="small"
      icon={<ArrowDown />}
      aria-label={labels.moveDown}
      disabled={disabled || index === count - 1}
      onClick={() => onMove(index + 1)}
    />
    <Button
      danger
      size="small"
      icon={<X />}
      aria-label={labels.delete}
      title={labels.delete}
      disabled={disabled || deleteDisabled}
      onClick={onDelete}
    />
  </div>
);

export default RowControls;
