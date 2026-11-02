import { ArrowDown, ArrowUp, Copy, X } from 'lucide-react';

import { useLiveMessages } from '~/components/context/messages';

import styles from './selection.module.css';

import Button from '../../button';

interface BulkActionsBarProps {
  count: number;
  disabled?: boolean;
  // Each on top of `disabled`, for a limit on the item count.
  duplicateDisabled?: boolean;
  deleteDisabled?: boolean;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onClear: () => void;
}

const BulkActionsBar = ({
  count,
  disabled = false,
  duplicateDisabled = false,
  deleteDisabled = false,
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
    <div className={styles.bar}>
      <div className={styles.count}>{messages.selection.count(count)}</div>
      <div className={styles.actions}>
        <Button
          size="small"
          icon={<Copy />}
          title={messages.selection.duplicate}
          disabled={disabled || duplicateDisabled}
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
          tone="danger"
          size="small"
          icon={<X />}
          title={messages.selection.delete}
          disabled={disabled || deleteDisabled}
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
