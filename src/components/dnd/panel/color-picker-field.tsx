import { useEffect, useRef, useState } from 'react';

import { ColorPicker } from '@jbpark/ui-kit';
import { useDebounce } from '@jbpark/use-hooks';

// The color picker reports every drag frame, and each commit re-parses and
// recompiles (#130). So the commit waits this long after the last change,
// while `liveValue` updates the swatch every frame.
const COLOR_COMMIT_DELAY = 75;

// Returns `value` when it is a 3- or 6-digit hex color, else black.
const normalizeToHex = (value: string): string => {
  const trimmed = value.trim();

  if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(trimmed)) {
    return trimmed;
  }

  return '#000000';
};

interface Props {
  // Any source text; anything but a hex color shows as black.
  value: string;
  onChange: (value: string) => void;
  // The picker's trigger is a `role="button"` element, which a `<label>`
  // can't point at, so it carries the field's name itself (#637).
  label: string;
}

const ColorPickerField = ({ value: source, onChange, label }: Props) => {
  const value = normalizeToHex(source);
  const [liveValue, setLiveValue] = useState(value);
  // The last `value` seen, to notice a change from outside during render.
  const [prevValue, setPrevValue] = useState(value);
  const lastCommittedRef = useRef(value);

  // Follow a change from outside, such as undo or another field. Done
  // during render, so the old color never paints.
  if (value !== prevValue) {
    setPrevValue(value);
    setLiveValue(value);
  }

  // `commit` reads this from handlers and timers only, so an effect is
  // enough.
  useEffect(() => {
    lastCommittedRef.current = value;
  }, [value]);

  const commit = (next: string) => {
    if (next === lastCommittedRef.current) {
      return;
    }

    lastCommittedRef.current = next;
    onChange(next);
  };

  const debouncedCommit = useDebounce(() => commit(liveValue), {
    delay: COLOR_COMMIT_DELAY,
    autoInvoke: false,
  });

  return (
    <ColorPicker
      aria-label={label}
      showText
      value={liveValue}
      onChange={next => {
        setLiveValue(next);
        debouncedCommit();
      }}
      onOpenChange={open => {
        // Commit at once when the picker closes, so an unmount can't drop
        // the last color.
        if (!open) {
          commit(liveValue);
        }
      }}
    />
  );
};

export default ColorPickerField;
