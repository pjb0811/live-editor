import { useLiveMessages } from '~/components/context/messages';
import { type DataAttrNode } from '~/utils/ast/types';
import { parseValue } from '~/utils/ast/value';
import { cn } from '~/utils/cn';

import { useDndEditOptions } from '../edit-options';
import { resolveRenderEntry, toBindingFields } from '../panel-binding';
import Children from './children/children';
import ColorField from './fields/color-field';
import { CONTROL_CLASS } from './fields/control-class';
import FieldError from './fields/field-error';
import { getFieldKind } from './fields/field-kind';
import JSXEditorField from './fields/jsx-editor-field';
import LabeledField from './fields/labeled-field';
import { useFieldState } from './fields/use-field-state';
import Items from './items/items';
import type { FieldProps } from './types';

// The built-in control for one binding: native inputs, selects and text
// areas, plus the structural and source editors. `@jbpark/live-editor/ui-kit`
// offers ui-kit controls in their place through `renderField`.
const BuiltinField = ({ binding, onNodeChange }: FieldProps) => {
  const messages = useLiveMessages();
  const { id, value, rawValue, onChange } = binding;
  const {
    text,
    setText,
    validationError,
    errorId,
    controlProps,
    commitIfChanged,
    validateAndCommit,
  } = useFieldState(binding);

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
      // The HTML source as text; `@jbpark/live-editor/ui-kit` offers a
      // formatting editor instead.
      <textarea
        {...controlProps}
        rows={4}
        value={text}
        className={cn(CONTROL_CLASS, 'font-mono text-xs')}
        onChange={e => setText(e.target.value)}
        onBlur={e => commitIfChanged(e.target.value)}
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
              <LabeledField
                binding={{ ...nested, value: val }}
                labelClassName="block text-xs font-medium text-gray-600"
                label={nested.label}
              >
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
              </LabeledField>
            </div>
          );
        })}
      </div>
    );
  }

  if (kind === 'boolean') {
    return (
      <input
        {...controlProps}
        type="checkbox"
        checked={value === true || value === 'true'}
        className="size-4"
        onChange={e => {
          onChange(e.target.checked);
        }}
      />
    );
  }

  if (kind === 'select') {
    return (
      <select
        {...controlProps}
        value={rawValue}
        className={CONTROL_CLASS}
        onChange={e => commitIfChanged(e.target.value)}
      >
        {(binding.options ?? []).map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (kind === 'color') {
    return (
      <ColorField
        {...controlProps}
        value={rawValue}
        onChange={commitIfChanged}
      />
    );
  }

  if (kind === 'date' || kind === 'datetime' || kind === 'time') {
    // The stored formats (`YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`, `HH:mm`) are the
    // ones these inputs read and write, so no conversion is needed.
    return (
      <div>
        <input
          {...controlProps}
          type={kind === 'datetime' ? 'datetime-local' : kind}
          value={rawValue}
          className={CONTROL_CLASS}
          onChange={e => validateAndCommit(e.target.value)}
        />
        <FieldError id={errorId} message={validationError} />
      </div>
    );
  }

  if (kind === 'url' || kind === 'email' || kind === 'tel') {
    return (
      <div>
        <input
          {...controlProps}
          type={kind}
          value={text}
          className={CONTROL_CLASS}
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
        <FieldError id={errorId} message={validationError} />
      </div>
    );
  }

  if (kind === 'number') {
    return (
      <div>
        <input
          {...controlProps}
          type="number"
          step={binding.step}
          value={text}
          className={CONTROL_CLASS}
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
        <FieldError id={errorId} message={validationError} />
      </div>
    );
  }

  return (
    <div>
      <textarea
        {...controlProps}
        rows={2}
        value={text}
        className={CONTROL_CLASS}
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
      <FieldError id={errorId} message={validationError} />
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
