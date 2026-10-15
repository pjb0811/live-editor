import { Checkbox } from '@jbpark/ui-kit';

import { useLiveMessages } from '~/components/context/messages';

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

  const isAllSelected = total > 0 && selected >= total;

  return (
    <Checkbox
      className="text-xs"
      checked={isAllSelected}
      indeterminate={selected > 0 && !isAllSelected}
      disabled={disabled}
      onChange={() => (isAllSelected ? onClear() : onSelectAll())}
    >
      {messages.selection.selectAll}
    </Checkbox>
  );
};

export default SelectAllCheckbox;
