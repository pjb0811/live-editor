import { useEffect, useRef, useState } from 'react';

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
import { parseValue, validateBindingValue } from '~/utils/ast';

import type { PanelBinding } from '../dnd';
import Children from './children';
import { ICON_MAP, ICON_OPTIONS } from './icon-map';
import Items from './items';

interface Props {
  binding: PanelBinding;
  // `Items`/`Children` edit a *different* element than `binding` itself —
  // an array item or a sibling child, each with its own id/label/property —
  // which `binding.onChange`'s single-value shape can't express. This is
  // the internal, node-level escape hatch those two still need (see #237's
  // documented items/children boundary); it isn't part of the public
  // `PanelBinding` surface a custom `renderPanel` sees.
  onNodeChange?: (params: {
    id: string;
    label: string;
    property: string;
    value: unknown;
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
  value: string;
  onChange: (value: string) => void;
}

const ColorPickerField = ({ value, onChange }: ColorPickerFieldProps) => {
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
    onChange(next);
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

const Field = ({ binding, onNodeChange }: Props) => {
  // `value` is already structured (its real JS type); `rawValue` is the exact
  // source text used for the raw editors (Items/code/textarea) and as the
  // <input> defaultValue. See #238.
  const { id, value, rawValue, onChange } = binding;

  const [validationError, setValidationError] = useState<string | null>(null);

  if (
    binding.property === 'items' ||
    binding.property === 'data' ||
    binding.type === 'array'
  ) {
    return (
      <Items
        value={rawValue}
        render={binding.render}
        onChange={onChange}
        onChildChange={onNodeChange}
      />
    );
  }

  if (binding.type === 'richtext') {
    return (
      <TiptapEditor
        value={rawValue}
        onChange={next => {
          if (next !== rawValue) {
            onChange(next);
          }
        }}
      />
    );
  }

  if (binding.property === BINDING_PROP.INNER_HTML || binding.type === 'jsx') {
    const isHTML = binding.property === BINDING_PROP.INNER_HTML;

    return (
      <CoreEditor
        value={rawValue}
        height="150px"
        fragment={!isHTML}
        raw={isHTML}
        onSave={next => {
          if (next !== rawValue) {
            onChange(next);
          }
        }}
      />
    );
  }

  if (binding.property === 'children' && Array.isArray(value)) {
    return (
      <Children value={value} onChange={onChange} onNodeChange={onNodeChange} />
    );
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const objectValue = value as Record<string, unknown>;

    return (
      <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-2">
        {Object.entries(objectValue).map(([key, val]) => (
          <div key={key} className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">
              {key}
            </label>
            <Field
              binding={{
                id,
                label: key,
                property:
                  binding.render?.[key] && 'type' in binding.render[key]
                    ? (binding.render[key].type as string)
                    : key,
                type:
                  binding.render?.[key] && 'type' in binding.render[key]
                    ? (binding.render[key] as { type: PanelBinding['type'] })
                        .type
                    : undefined,
                render:
                  binding.render?.[key] && !('type' in binding.render[key])
                    ? (binding.render[key] as PanelBinding['render'])
                    : undefined,
                value: val,
                rawValue:
                  typeof val === 'object' && val !== null
                    ? JSON.stringify(val)
                    : String(val),
                onChange: next => {
                  onChange({ ...objectValue, [key]: next });
                },
              }}
              onNodeChange={onNodeChange}
            />
          </div>
        ))}
      </div>
    );
  }

  if (binding.type === 'boolean' || typeof value === 'boolean') {
    return (
      <Checkbox
        checked={value === true || value === 'true'}
        onChange={checked => {
          onChange(checked);
        }}
      />
    );
  }

  const stringValue = rawValue;

  if (binding.options && Array.isArray(binding.options)) {
    return (
      <Select
        value={stringValue}
        options={binding.options}
        onChange={next => {
          if (next !== value) {
            onChange(next);
          }
        }}
      />
    );
  }

  if (binding.type === 'color' || isColorProperty(binding.property)) {
    return (
      <ColorPickerField
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
              onChange(next);
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
              onChange(next);
            }
          }}
        />
        {validationError && (
          <p className="mt-1 text-xs text-red-500">{validationError}</p>
        )}
      </div>
    );
  }

  // Checks `type` too, not just `widget`: a `type: 'icon-picker'` binding
  // parsed by `parseBinding` is already normalized to `widget: 'icon-picker'`
  // (see #236), but a hand-constructed BindingItem — e.g. the nested
  // render-leaf case just above, which doesn't carry `widget` — can still
  // arrive with the alias directly in `type`.
  if (binding.widget === 'icon-picker' || binding.type === 'icon-picker') {
    const SelectedIcon = ICON_MAP[stringValue];

    return (
      <div className="flex items-center gap-2">
        <Select
          value={stringValue}
          options={ICON_OPTIONS}
          onChange={next => {
            if (next !== value) {
              onChange(next);
            }
          }}
        />
        {SelectedIcon && <SelectedIcon size={18} className="shrink-0" />}
      </div>
    );
  }

  if (binding.widget === 'asset-picker' || binding.type === 'asset-picker') {
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
              onChange(next);
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
              onChange(next);
            }
          }}
        />
        {validationError && (
          <p className="mt-1 text-xs text-red-500">{validationError}</p>
        )}
      </div>
    );
  }

  if (binding.type === 'number' || typeof value === 'number') {
    return (
      <div>
        <Input
          type="number"
          defaultValue={stringValue}
          placeholder="Enter a numeric value"
          onBlur={e => {
            const raw = e.target.value.trim();
            // Commit a real number, not a numeric string — the AST boundary
            // and `validateBindingValue` (its `min`/`max`) both expect the
            // value as its declared type now. An unparseable entry falls
            // back to the raw text so a genuine mistake still round-trips
            // rather than becoming `NaN`.
            const next: unknown =
              raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
            const result = validateBindingValue(binding, next);

            if (!result.valid) {
              setValidationError(result.message ?? 'Invalid value.');
              return;
            }

            setValidationError(null);

            if (next !== value) {
              onChange(next);
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
        defaultValue={rawValue}
        placeholder="Enter a value"
        onBlur={e => {
          const raw = e.target.value.trim();
          // Untyped field: infer the value's type from the text the user
          // entered (so `42` commits as a number), the way the old boundary
          // did — but here, in the presentation layer, not by re-guessing in
          // the AST pipeline. A declared string-family type keeps the text
          // verbatim, so `"{x}"` stays a string.
          const next: unknown = binding.type ? raw : parseValue(raw);
          const result = validateBindingValue(binding, next);

          if (!result.valid) {
            setValidationError(result.message ?? 'Invalid value.');
            return;
          }

          setValidationError(null);

          if (next !== rawValue) {
            onChange(next);
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
