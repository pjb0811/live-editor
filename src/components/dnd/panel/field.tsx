import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Checkbox,
  ColorPicker,
  DatePicker,
  Input,
  Select,
  Upload,
  type UploadFile,
} from '@jbpark/ui-kit';
import { useDebounce } from '@jbpark/use-hooks';

import CoreEditor from '~/components/editor/core';
import TiptapEditor from '~/components/editor/tiptap';
import { BINDING_PROP } from '~/constants';
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
  onChange?: (params: {
    id: string;
    label: string;
    property: string;
    value: string;
  }) => void;
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

const parseDateValue = (value: string): Date | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatDateValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

// ColorPicker's onChange fires on every drag frame — committing straight
// to `onChange` (which drives the AST parse/mutate/re-serialize +
// generateSections + compile pipeline, see #130) makes a single drag cost
// upward of 15-25ms per frame. Debouncing the *commit* keeps that pipeline
// to roughly one run per pause instead of one per frame, while a local
// `liveValue` state keeps the swatch/hex text updating every frame for
// responsiveness — ColorPicker is fully controlled (`useControllableState`
// with `value` always set here), so without this it would visually snap
// back to the last committed color between debounced commits.
const COLOR_COMMIT_DELAY = 75;

interface ColorPickerFieldProps {
  id: string;
  label: string;
  property: string;
  value: string;
  onChange?: (params: {
    id: string;
    label: string;
    property: string;
    value: string;
  }) => void;
}

const ColorPickerField = ({
  id,
  label,
  property,
  value,
  onChange,
}: ColorPickerFieldProps) => {
  const [liveValue, setLiveValue] = useState(value);
  // Tracks `value` purely to detect an external change during render (see
  // below) — refs can't be read/written during render, so this has to be
  // state even though nothing here reads `prevValue` itself afterward.
  const [prevValue, setPrevValue] = useState(value);
  const lastCommittedRef = useRef(value);

  // The committed `value` can also change from outside (undo/redo, another
  // field touching the same binding) — stay in sync with it rather than
  // only ever tracking our own commits. Adjusted during render (React's
  // recommended "reset state when a prop changes" pattern) rather than in
  // an effect, so the mismatched frame never actually paints.
  if (value !== prevValue) {
    setPrevValue(value);
    setLiveValue(value);
  }

  // `lastCommittedRef` only needs to be current by the time `commit` next
  // runs (always from an event handler / debounce timer, never render), so
  // syncing it in an effect — instead of alongside the state adjustment
  // above — keeps the ref access out of the render phase entirely.
  useEffect(() => {
    lastCommittedRef.current = value;
  }, [value]);

  const commit = (next: string) => {
    if (next === lastCommittedRef.current) {
      return;
    }
    lastCommittedRef.current = next;
    onChange?.({ id, label, property, value: next });
  };

  const debouncedCommit = useDebounce(() => commit(liveValue), {
    delay: COLOR_COMMIT_DELAY,
    autoInvoke: false,
  });

  return (
    <ColorPicker
      showText
      value={liveValue}
      onChange={next => {
        setLiveValue(next);
        debouncedCommit();
      }}
      onOpenChange={open => {
        // Flush immediately on close (picker dismissed / selection
        // finished) instead of waiting out the debounce window, so the
        // last color is never at risk of being dropped by an unmount
        // racing the pending timeout.
        if (!open) {
          commit(liveValue);
        }
      }}
    />
  );
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
            property: binding.property,
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
              property: binding.property,
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
              property: binding.property,
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
            property: binding.property,
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
                  property: binding.property,
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
            property: binding.property,
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
              property: binding.property,
              value: next,
            });
          }
        }}
      />
    );
  }

  if (binding.type === 'color' || isColorProperty(binding.property)) {
    return (
      <ColorPickerField
        id={id}
        label={binding.label}
        property={binding.property}
        value={normalizeToHex(stringValue)}
        onChange={onChange}
      />
    );
  }

  if (binding.type === 'date') {
    return (
      <div>
        <DatePicker
          defaultValue={parseDateValue(stringValue)}
          onChange={date => {
            const next = date ? formatDateValue(date) : '';
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
                property: binding.property,
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

            if (next !== value) {
              onChange?.({
                id,
                label: binding.label,
                property: binding.property,
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
                property: binding.property,
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
    const defaultUploadValue: UploadFile[] = stringValue
      ? [
          {
            uid: 'current',
            name: stringValue.split('/').pop() || 'asset',
            url: stringValue,
          },
        ]
      : [];

    return (
      <div className="space-y-2">
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
                property: binding.property,
                value: next,
              });
            }
          }}
        />
        <Upload
          multiple={false}
          maxCount={1}
          accept="image/*"
          defaultValue={defaultUploadValue}
          onChange={files => {
            const next = files[0]?.url ?? '';

            if (next !== value) {
              onChange?.({
                id,
                label: binding.label,
                property: binding.property,
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

  if (typeof parsedValue === 'number') {
    return (
      <div>
        <Input
          type="number"
          defaultValue={stringValue}
          placeholder="Enter a numeric value"
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
                property: binding.property,
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

          if (next !== value) {
            onChange?.({
              id,
              label: binding.label,
              property: binding.property,
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
