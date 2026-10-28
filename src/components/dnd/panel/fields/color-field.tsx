import { useEffect, useRef, useState } from 'react';

import { useDebounce } from '@jbpark/use-hooks';

import { cn } from '~/utils/cn';

import { CONTROL_CLASS } from './control-class';

// A color input reports every drag frame, and each commit re-parses and
// recompiles (#130). So the commit waits this long after the last change,
// while `liveValue` updates the swatch every frame.
const COLOR_COMMIT_DELAY = 75;

// `value` as the `#rrggbb` a color input takes: a 6-digit hex color as is,
// a 3-digit one expanded, anything else black.
const normalizeToHex = (value: string): string => {
  const trimmed = value.trim();

  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;

    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return '#000000';
};

interface Props extends Pick<
  React.ComponentProps<'input'>,
  'id' | 'aria-label' | 'aria-invalid' | 'aria-describedby'
> {
  // Any source text; anything but a hex color shows as black.
  value: string;
  onChange: (value: string) => void;
}

// A native color input with the source text beside it. Commits shortly
// after the last drag frame, and at once on blur so leaving the field
// can't drop the last color.
const ColorField = ({ value: source, onChange, ...controlProps }: Props) => {
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
    <div className="flex items-center gap-2">
      <input
        {...controlProps}
        type="color"
        value={liveValue}
        className={cn(CONTROL_CLASS, 'h-8 w-12 shrink-0 p-0.5')}
        onChange={e => {
          setLiveValue(e.target.value);
          debouncedCommit();
        }}
        onBlur={() => commit(liveValue)}
      />
      <code className="text-xs text-gray-600">{source}</code>
    </div>
  );
};

export default ColorField;
