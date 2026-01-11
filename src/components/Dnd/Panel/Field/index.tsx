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

interface Props {
  binding: BindingItem;
  id: string;
  value: string;
  onChange?: (params: { id: string; label: string; value: string }) => void;
}

const isColorProperty = (propertyName: string): boolean => {
  const name = propertyName.toLowerCase();
  return name.includes('color');
};

const normalizeToHex = (value: string): string => {
  const trimmed = value.trim();

  if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(trimmed)) {
    return trimmed;
  }
  return '#000000';
};

const Field = ({ binding, id, value, onChange }: Props) => {
  const parsedValue = useMemo(() => {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }, [value]);

  if (binding.property === 'items' || binding.property === 'data') {
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

  if (
    typeof parsedValue === 'object' &&
    parsedValue !== null &&
    !Array.isArray(parsedValue)
  ) {
    return (
      <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-2">
        {Object.entries(parsedValue).map(([key, val]) => (
          <div key={key} className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">
              {key}
            </label>
            <Field
              binding={{ label: key, property: key }}
              id={id}
              value={
                typeof val === 'object' ? JSON.stringify(val) : String(val)
              }
              onChange={({ value: next }) => {
                const updated = {
                  ...parsedValue,
                  [key]: next,
                };

                onChange?.({
                  id,
                  label: binding.label,
                  value: JSON.stringify(updated),
                });
              }}
            />
          </div>
        ))}
      </div>
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

  const stringValue = String(value);
  const isColorProp = isColorProperty(binding.property);

  if (isColorProp) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="size-8 cursor-pointer"
          defaultValue={normalizeToHex(stringValue)}
          onBlur={e => {
            const next = e.target.value;
            if (next !== value) {
              onChange?.({
                id,
                label: binding.label,
                value: next,
              });
            }
          }}
        />
      </div>
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
