import { Checkbox } from '@jbpark/ui-kit';

interface Props {
  checked: boolean;
  disabled?: boolean;
  onToggle: (shiftKey: boolean) => void;
}

// The checkbox that selects an Items or Children row. ui-kit's `Checkbox`
// reports only the new state, so the click around it reads Shift for range
// selection; Space and Shift+Space reach it as a click too.
const SelectionCheckbox = ({ checked, disabled = false, onToggle }: Props) => (
  <div
    onClick={e => {
      if (!disabled) {
        onToggle(e.shiftKey);
      }
    }}
    className="inline-flex"
  >
    <Checkbox checked={checked} disabled={disabled} />
  </div>
);

export default SelectionCheckbox;
