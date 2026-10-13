import { type ComponentProps, useState } from 'react';

import {
  Checkbox,
  DatePicker,
  Input,
  RichTextEditor,
  Select,
} from '@jbpark/ui-kit';

import { useLiveMessages } from '~/components/context/messages';
import { type DataAttrNode } from '~/utils/ast/types';
import { validateBindingValue } from '~/utils/ast/validate';
import { parseValue } from '~/utils/ast/value';

import { useDndEditOptions } from '../edit-options';
import { resolveRenderEntry, toBindingFields } from '../panel-binding';
import Children from './children';
import ColorPickerField from './color-picker-field';
import { getFieldKind } from './field-kind';
import Items from './items';
import JSXEditorField from './jsx-editor-field';
import type { FieldProps } from './types';

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

// The formatting controls for a small sidebar field, not every preset.
const RICHTEXT_TOOLBAR: ComponentProps<typeof RichTextEditor>['toolbar'] = [
  'bold',
  'italic',
  'underline',
  'bulletList',
  'orderedList',
  'link',
];

// `mb-0` matters: `dist/style.css` has no CSS reset, so without it a `<p>`
// keeps the browser's bottom margin and the fields below jump when the
// error appears (#409).
const FieldError = ({ message }: { message: string | null }) =>
  message ? <p className="mt-1 mb-0 text-xs text-red-500">{message}</p> : null;

const BuiltinField = ({ binding, onNodeChange }: FieldProps) => {
  const messages = useLiveMessages();
  const validationOptions = { messages: messages.validation };
  // `value` is the JS value; `rawValue` is the source text, for the text
  // controls and the source editors (#238).
  const { id, value, rawValue, onChange } = binding;

  const [validationError, setValidationError] = useState<string | null>(null);

  // What the user is typing, for the inputs that commit on blur (url,
  // number, text area). Reset during render when `rawValue` changes from outside,
  // such as undo, so the old text isn't committed on blur (#284).
  const [text, setText] = useState(rawValue);
  const [prevRawValue, setPrevRawValue] = useState(rawValue);

  if (rawValue !== prevRawValue) {
    setPrevRawValue(rawValue);
    setText(rawValue);
  }

  const kind = getFieldKind(binding);

  if (kind === 'readonly') {
    return (
      <div
        className="space-y-1 rounded border border-dashed border-amber-200 p-3
          text-xs text-amber-700"
      >
        <div>{messages.panel.expressionPreserved}</div>
        <code className="block overflow-x-auto text-amber-800">{rawValue}</code>
        <div>{messages.panel.useCodeEditor}</div>
      </div>
    );
  }

  // Skips a commit that doesn't change anything, comparing a string with
  // `rawValue` and anything else with `value`.
  const commitIfChanged = (next: unknown) => {
    const current = typeof next === 'string' ? rawValue : value;

    if (next !== current) {
      onChange(next);
    }
  };

  // Commits `next` if it passes the binding's validation, else shows why
  // not.
  const validateAndCommit = (next: unknown) => {
    const result = validateBindingValue(binding, next, validationOptions);

    if (!result.valid) {
      setValidationError(result.message ?? messages.panel.invalidValue);

      return;
    }

    setValidationError(null);
    commitIfChanged(next);
  };

  if (kind === 'items') {
    return (
      <Items
        value={rawValue}
        render={binding.render}
        minItems={binding.minItems}
        maxItems={binding.maxItems}
        onChange={onChange}
        onChildChange={onNodeChange}
      />
    );
  }

  if (kind === 'richtext') {
    return (
      <RichTextEditor
        value={rawValue}
        toolbar={RICHTEXT_TOOLBAR}
        onChange={commitIfChanged}
      />
    );
  }

  if (kind === 'html' || kind === 'jsx') {
    return (
      <JSXEditorField
        value={rawValue}
        isHTML={kind === 'html'}
        onSave={commitIfChanged}
      />
    );
  }

  if (kind === 'children') {
    return (
      <Children
        value={value as DataAttrNode[]}
        onChange={onChange}
        onNodeChange={onNodeChange}
      />
    );
  }

  if (kind === 'object') {
    const objectValue = value as Record<string, unknown>;

    return (
      <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-2">
        {Object.entries(objectValue).map(([key, val]) => {
          const nested = resolveRenderEntry(binding.render, key);

          return (
            <div key={key} className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">
                {nested.label}
              </label>
              <Field
                binding={{
                  ...toBindingFields(nested),
                  id,
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
          );
        })}
      </div>
    );
  }

  if (kind === 'boolean') {
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

  if (kind === 'select') {
    return (
      <Select
        value={stringValue}
        options={binding.options ?? []}
        onChange={commitIfChanged}
      />
    );
  }

  if (kind === 'color') {
    return <ColorPickerField value={stringValue} onChange={commitIfChanged} />;
  }

  if (kind === 'date') {
    return (
      <div>
        <DatePicker
          value={parseDateValue(stringValue)}
          onChange={date =>
            validateAndCommit(date ? formatDateValue(date) : '')
          }
        />
        <FieldError message={validationError} />
      </div>
    );
  }

  if (kind === 'url' || kind === 'email' || kind === 'tel') {
    return (
      <div>
        <Input
          type={kind}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={
            kind === 'url'
              ? messages.panel.urlPlaceholder
              : kind === 'email'
                ? messages.panel.emailPlaceholder
                : messages.panel.telPlaceholder
          }
          onBlur={e => validateAndCommit(e.target.value.trim())}
        />
        <FieldError message={validationError} />
      </div>
    );
  }

  if (kind === 'number') {
    return (
      <div>
        <Input
          type="number"
          step={binding.step}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={messages.panel.numberPlaceholder}
          onBlur={e => {
            const raw = e.target.value.trim();
            // Commit a number, not a numeric string, as `update` and
            // `validateBindingValue` expect. Text that isn't a number is
            // committed as is rather than as `NaN`.
            const next: unknown =
              raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : raw;

            validateAndCommit(next);
          }}
        />
        <FieldError message={validationError} />
      </div>
    );
  }

  return (
    <div>
      <Input.TextArea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={messages.panel.textPlaceholder}
        onBlur={e => {
          const raw = e.target.value.trim();
          // An untyped field reads the text as a value, so `42` commits as a
          // number. A declared type keeps the text as typed.
          const next: unknown = binding.type ? raw : parseValue(raw);

          validateAndCommit(next);
        }}
      />
      <FieldError message={validationError} />
    </div>
  );
};

// `Live.Dnd.Field`: the host's `renderField` first, then the built-in
// control. Nested object keys and item properties render `Field` too, so
// `renderField` reaches every field.
const Field = (props: FieldProps) => {
  const { renderField } = useDndEditOptions();
  const builtin = <BuiltinField {...props} />;

  if (!renderField) {
    return builtin;
  }

  const custom = renderField(props, builtin);

  return custom === undefined ? builtin : <>{custom}</>;
};

export default Field;
