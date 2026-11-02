import styles from './selection.module.css';

interface Props {
  checked: boolean;
  disabled?: boolean;
  onToggle: (shiftKey: boolean) => void;
}

// The checkbox that selects an Items or Children row. Reads Shift from the
// click for range selection; Space and Shift+Space reach it as a click too.
// The parent owns `checked`, so the box shows the new state once `onToggle`
// updates it.
const SelectionCheckbox = ({ checked, disabled = false, onToggle }: Props) => (
  <input
    type="checkbox"
    className={styles.checkbox}
    checked={checked}
    disabled={disabled}
    readOnly
    onClick={e => onToggle(e.shiftKey)}
  />
);

export default SelectionCheckbox;
