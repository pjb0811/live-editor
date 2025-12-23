import { useMemo } from 'react';

import { cn } from '~/utils';
import { type BindingItem } from '~/utils/ast';

import Children from '../Children';
import Items from '../Items';

interface Props {
  binding: BindingItem;
  id: string;
  value: string;
  onChange?: (params: { id: string; label: string; value: string }) => void;
}

const Field = ({ binding, id, value, onChange }: Props) => {
  const parsedValue = useMemo(() => {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }, [value]);

  if (binding.property === 'items') {
    return (
      <Items
        value={value}
        onChange={next => {
          onChange?.({
            id,
            label: binding.label,
            value: next,
          });
        }}
      />
    );
  }

  if (binding.property === 'children' && Array.isArray(parsedValue)) {
    return (
      <Children
        value={parsedValue}
        onChange={next => {
          onChange?.({
            id,
            label: binding.label,
            value: next,
          });
        }}
        onNodeChange={onChange}
      />
    );
  }

  if (typeof parsedValue === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={parsedValue}
        onChange={e => {
          onChange?.({
            id,
            label: binding.label,
            value: e.target.checked.toString(),
          });
        }}
      />
    );
  }

  return (
    <input
      type={typeof parsedValue === 'number' ? 'number' : 'text'}
      className={cn(
        'w-full rounded border px-2 py-1 text-sm',
        'focus:border-blue-500 focus:outline-none',
      )}
      defaultValue={value}
      placeholder="값을 입력하세요"
      onBlur={e => {
        const next = e.target.value.trim();
        if (next && next !== value) {
          onChange?.({
            id,
            label: binding.label,
            value: next,
          });
        }
      }}
    />
  );
};

export default Field;
