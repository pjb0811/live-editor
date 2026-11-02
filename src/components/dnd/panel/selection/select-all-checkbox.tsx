import { useEffect, useRef } from 'react';

import { useLiveMessages } from '~/components/context/messages';

import styles from './selection.module.css';

interface Props {
  total: number;
  selected: number;
  disabled?: boolean;
  onSelectAll: () => void;
  onClear: () => void;
}

// Selects or clears every row of an Items or Children editor at once (#638).
// Checked when every row is selected, indeterminate when only some are.
// Clicking it selects all rows unless all already are, then clears them.
const SelectAllCheckbox = ({
  total,
  selected,
  disabled = false,
  onSelectAll,
  onClear,
}: Props) => {
  const messages = useLiveMessages();

  const inputRef = useRef<HTMLInputElement>(null);

  const isAllSelected = total > 0 && selected >= total;
  const isIndeterminate = selected > 0 && !isAllSelected;

  // `indeterminate` is a DOM property only, with no attribute for it.
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  return (
    <label className={styles.selectAll}>
      <input
        ref={inputRef}
        type="checkbox"
        className={styles.checkbox}
        checked={isAllSelected}
        disabled={disabled}
        onChange={() => (isAllSelected ? onClear() : onSelectAll())}
      />
      {messages.selection.selectAll}
    </label>
  );
};

export default SelectAllCheckbox;
