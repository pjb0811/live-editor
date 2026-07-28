import { useMemo, useState } from 'react';

import { Checkbox, ColorPicker, Input, Select } from '@jbpark/ui-kit';

import CoreEditor from '~/components/editor/core';
import TiptapEditor from '~/components/editor/tiptap';
import { BINDING_PROP } from '~/enums';
import {
  type BindingItem,
  parseValue,
  validateBindingValue,
} from '~/utils/ast';

import Children from './children';
import { ICON_MAP } from './icon-map';
import Items from './items';

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

const ICON_OPTIONS = Object.entries(ICON_MAP).map(([name, Icon]) => ({
  label: (
    <span className="flex items-center gap-2">
      <Icon size={14} />
      {name}
    </span>
  ),
  value: name,
}));

const Field = ({ binding, id, value, onChange }: Props) => {
  const parsedValue = useMemo(() => {
    return parseValue(value);
  }, [value]);

  const [validationError, setValidationError] = useState<string | null>(null);

  if (
    binding.property === 'items' ||
    binding.property === 'data' ||
    binding.type === 'array'
  ) {
    return (
      <Items
        value={value}
        render={binding.render}
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

  if (binding.type === 'richtext') {
    return (
      <TiptapEditor
        value={value}
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

  if (binding.property === BINDING_PROP.INNER_HTML || binding.type === 'jsx') {
    const isHTML = binding.property === BINDING_PROP.INNER_HTML;

    return (
      <CoreEditor
        value={value}
        height="150px"
        fragment={!isHTML}
        raw={isHTML}
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
              binding={{
                label: key,
                property:
                  binding.render?.[key] && 'type' in binding.render[key]
                    ? (binding.render[key].type as string)
                    : key,
                type:
                  binding.render?.[key] && 'type' in binding.render[key]
                    ? (binding.render[key] as { type: BindingItem['type'] })
                        .type
                    : undefined,
                render:
                  binding.render?.[key] && !('type' in binding.render[key])
                    ? (binding.render[key] as BindingItem['render'])
                    : undefined,
              }}
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

  if (binding.type === 'boolean' || typeof parsedValue === 'boolean') {
    return (
      <Checkbox
        checked={parsedValue === true || parsedValue === 'true'}
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

  if (binding.type === 'color' || isColorProperty(binding.property)) {
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

  if (binding.type === 'date') {
    return (
      <div>
        <Input
          type="date"
          defaultValue={stringValue}
          onBlur={e => {
            const next = e.target.value.trim();
            const result = validateBindingValue(binding, next);

            if (!result.valid) {
              setValidationError(result.message ?? 'Invalid value.');
              return;
            }

            setValidationError(null);

            if (next && next !== value) {
              onChange?.({
                id,
                label: binding.label,
                value: next,
              });
            }
          }}
        />
        {validationError && (
          <p className="mt-1 text-xs text-red-500">{validationError}</p>
        )}
      </div>
    );
  }

  if (binding.type === 'url') {
    return (
      <div>
        <Input
          type="url"
          defaultValue={stringValue}
          placeholder="https://example.com"
          onBlur={e => {
            const next = e.target.value.trim();
            const result = validateBindingValue(binding, next);

            if (!result.valid) {
              setValidationError(result.message ?? 'Invalid value.');
              return;
            }

            setValidationError(null);

            if (next && next !== value) {
              onChange?.({
                id,
                label: binding.label,
                value: next,
              });
            }
          }}
        />
        {validationError && (
          <p className="mt-1 text-xs text-red-500">{validationError}</p>
        )}
      </div>
    );
  }

  if (binding.type === 'icon-picker') {
    const SelectedIcon = ICON_MAP[stringValue];

    return (
      <div className="flex items-center gap-2">
        <Select
          value={stringValue}
          options={ICON_OPTIONS}
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
        {SelectedIcon && <SelectedIcon size={18} className="shrink-0" />}
      </div>
    );
  }

  if (binding.type === 'asset-picker') {
    return (
      <div className="space-y-2">
        {stringValue && (
          <img
            src={stringValue}
            alt=""
            className="h-20 w-20 rounded border border-gray-200 object-cover"
          />
        )}
        <Input
          defaultValue={stringValue}
          placeholder="Enter an image URL"
          onBlur={e => {
            const next = e.target.value.trim();
            const result = validateBindingValue(binding, next);

            if (!result.valid) {
              setValidationError(result.message ?? 'Invalid value.');
              return;
            }

            setValidationError(null);

            if (next !== value) {
              onChange?.({
                id,
                label: binding.label,
                value: next,
              });
            }
          }}
        />
        <input
          type="file"
          accept="image/*"
          onChange={e => {
            const file = e.target.files?.[0];

            if (!file) {
              return;
            }

            const reader = new FileReader();

            reader.onload = () => {
              const dataUrl = reader.result;

              if (typeof dataUrl === 'string') {
                onChange?.({
                  id,
                  label: binding.label,
                  value: dataUrl,
                });
              }
            };

            reader.readAsDataURL(file);
          }}
        />
        {validationError && (
          <p className="mt-1 text-xs text-red-500">{validationError}</p>
        )}
      </div>
    );
  }

  if (typeof parsedValue === 'number') {
    return (
      <div>
        <Input
          type="number"
          defaultValue={stringValue}
          placeholder="Enter a numeric value"
          onBlur={e => {
            const next = e.target.value.trim();
            const result = validateBindingValue(
              binding,
              next ? Number(next) : '',
            );

            if (!result.valid) {
              setValidationError(result.message ?? 'Invalid value.');
              return;
            }

            setValidationError(null);

            if (next && next !== value) {
              onChange?.({
                id,
                label: binding.label,
                value: next,
              });
            }
          }}
        />
        {validationError && (
          <p className="mt-1 text-xs text-red-500">{validationError}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <Input.TextArea
        defaultValue={value}
        placeholder="Enter a value"
        onBlur={e => {
          const next = e.target.value.trim();
          const result = validateBindingValue(binding, next);

          if (!result.valid) {
            setValidationError(result.message ?? 'Invalid value.');
            return;
          }

          setValidationError(null);

          if (next && next !== value) {
            onChange?.({
              id,
              label: binding.label,
              value: next,
            });
          }
        }}
      />
      {validationError && (
        <p className="mt-1 text-xs text-red-500">{validationError}</p>
      )}
    </div>
  );
};

export default Field;
