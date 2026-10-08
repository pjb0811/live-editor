import {
  type ComponentProps,
  type FocusEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Checkbox,
  ColorPicker,
  DatePicker,
  Input,
  RichTextEditor,
  Select,
} from '@jbpark/ui-kit';
import { useDebounce } from '@jbpark/use-hooks';
import type {
  EditorSelection,
  EditorView,
  ViewUpdate,
} from '@uiw/react-codemirror';

import { useLiveMessages } from '~/components/context/messages';
import CoreEditor from '~/components/editor/core';
import { type DataAttrNode } from '~/utils/ast/types';
import { validateBindingValue } from '~/utils/ast/validate';
import { parseValue } from '~/utils/ast/value';

import { useDndEditOptions } from '../edit-options';
import { resolveRenderEntry, toBindingFields } from '../panel-binding';
import Children from './children';
import { getFieldKind } from './field-kind';
import Items from './items';
import type { FieldProps } from './types';

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

// The color picker reports every drag frame, and each commit re-parses and
// recompiles (#130). So the commit waits this long after the last change,
// while `liveValue` updates the swatch every frame.
const COLOR_COMMIT_DELAY = 75;

// The formatting controls for a small sidebar field, not every preset.
const RICHTEXT_TOOLBAR: ComponentProps<typeof RichTextEditor>['toolbar'] = [
  'bold',
  'italic',
  'underline',
  'bulletList',
  'orderedList',
  'link',
];

interface ColorPickerFieldProps {
  value: string;
  onChange: (value: string) => void;
}

interface JSXEditorFieldProps {
  value: string;
  isHTML: boolean;
  onSave: (value: string) => void;
}

// Keeps focus and selection when CodeMirror recreates its view, which
// `@uiw/react-codemirror` does when a moved item's effects reconnect under
// Strict Effects (#359).
const JSXEditorField = ({ value, isHTML, onSave }: JSXEditorFieldProps) => {
  const selectionRef = useRef<EditorSelection | null>(null);
  const focusedRef = useRef(false);

  const handleUpdate = useCallback((update: ViewUpdate) => {
    selectionRef.current = update.state.selection;
  }, []);

  const handleCreateEditor = useCallback((view: EditorView) => {
    if (selectionRef.current) {
      view.dispatch({ selection: selectionRef.current });
    }

    if (focusedRef.current) {
      view.focus();
    }
  }, []);

  const handleFocus = useCallback(() => {
    focusedRef.current = true;
  }, []);

  const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (
      event.relatedTarget &&
      !event.currentTarget.contains(event.relatedTarget as Node)
    ) {
      focusedRef.current = false;
    }
  }, []);

  return (
    <div onFocusCapture={handleFocus} onBlurCapture={handleBlur}>
      <CoreEditor
        value={value}
        height="150px"
        fragment={!isHTML}
        raw={isHTML}
        onSave={onSave}
        onUpdate={handleUpdate}
        onCreateEditor={handleCreateEditor}
      />
    </div>
  );
};

const ColorPickerField = ({ value, onChange }: ColorPickerFieldProps) => {
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

  if (kind === 'items') {
    return (
      <Items
        value={rawValue}
        render={binding.render}
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
    return (
      <ColorPickerField
        value={normalizeToHex(stringValue)}
        onChange={commitIfChanged}
      />
    );
  }

  if (kind === 'date') {
    return (
      <div>
        <DatePicker
          value={parseDateValue(stringValue)}
          onChange={date => {
            const next = date ? formatDateValue(date) : '';
            const result = validateBindingValue(
              binding,
              next,
              validationOptions,
            );

            if (!result.valid) {
              setValidationError(result.message ?? messages.panel.invalidValue);
              return;
            }

            setValidationError(null);

            commitIfChanged(next);
          }}
        />
        <FieldError message={validationError} />
      </div>
    );
  }

  if (kind === 'url') {
    return (
      <div>
        <Input
          type="url"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={messages.panel.urlPlaceholder}
          onBlur={e => {
            const next = e.target.value.trim();
            const result = validateBindingValue(
              binding,
              next,
              validationOptions,
            );

            if (!result.valid) {
              setValidationError(result.message ?? messages.panel.invalidValue);
              return;
            }

            setValidationError(null);

            commitIfChanged(next);
          }}
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
            const result = validateBindingValue(
              binding,
              next,
              validationOptions,
            );

            if (!result.valid) {
              setValidationError(result.message ?? messages.panel.invalidValue);
              return;
            }

            setValidationError(null);

            commitIfChanged(next);
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
          const result = validateBindingValue(binding, next, validationOptions);

          if (!result.valid) {
            setValidationError(result.message ?? messages.panel.invalidValue);
            return;
          }

          setValidationError(null);

          commitIfChanged(next);
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
