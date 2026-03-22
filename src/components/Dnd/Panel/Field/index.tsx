import { useMemo } from 'react';

import { Checkbox, ColorPicker, Input, Select } from '@jbpark/ui-kit';

import CoreEditor from '~/components/Editor/Core';
import { BINDING_PROP } from '~/enums';
import { type BindingItem, parseValue } from '~/utils/ast';

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
    return parseValue(value);
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
        onChildChange={onChange}
      />
    );
  }

  if (binding.property === BINDING_PROP.INNER_HTML) {
    return (
      <CoreEditor
        value={value}
        height="150px"
        fragment
        onSave={next => {
          if (next !== value) {
            onChange?.({
              id,
              label: binding.label,
              value: next,
            });
          }
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
                const convertedValue = parseValue(next);

                const updated = {
                  ...parsedValue,
                  [key]: convertedValue,
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
      <Checkbox
        checked={parsedValue}
        onChange={checked => {
          onChange?.({
            id,
            label: binding.label,
            value: checked.toString(),
          });
        }}
      />
    );
  }

  const stringValue = String(value);

  if (binding.options && Array.isArray(binding.options)) {
    return (
      <Select
        value={stringValue}
        options={binding.options}
        onChange={next => {
          if (next !== value) {
            onChange?.({
              id,
              label: binding.label,
              value: next,
            });
          }
        }}
      />
    );
  }

  const isColorProp = isColorProperty(binding.property);

  if (isColorProp) {
    return (
      <ColorPicker
        showText
        value={normalizeToHex(stringValue)}
        onChange={next => {
          if (next !== value) {
            onChange?.({
              id,
              label: binding.label,
              value: next,
            });
          }
        }}
      />
    );
  }

  if (typeof parsedValue === 'number') {
    return (
      <Input
        type="number"
        defaultValue={stringValue}
        placeholder="Enter a numeric value"
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
  }

  return (
    <Input.TextArea
      defaultValue={value}
      placeholder="Enter a value"
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
