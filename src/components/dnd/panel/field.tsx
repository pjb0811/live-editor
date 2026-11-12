import { useLiveMessages } from '~/components/context/messages';
import {
  getEditableSource,
  isEditablePrimitive,
  setEditableSource,
  setEditableValue,
} from '~/utils/ast/editable-value';
import { type DataAttrNode } from '~/utils/ast/types';
import { parseValue } from '~/utils/ast/value';
import { cn } from '~/utils/cn';

import styles from './fields/fields.module.css';

import { useDndEditOptions } from '../edit-options';
import { resolveRenderEntry, toBindingFields } from '../panel-binding';
import Children from './children/children';
import ColorField from './fields/color-field';
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
      <div className={styles.readonly}>
        <div>{messages.panel.expressionPreserved}</div>
        <code className={styles.readonlyCode}>{rawValue}</code>
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
        className={cn(styles.control, styles.mono)}
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

    // Commits an edit to one key as the object's source with only that key's
    // value replaced, so the rest stays as written (#722). A nested object or
    // array editor commits its own source, which goes in that key's place.
    // When the source can't be edited in place, the whole object is
    // committed as a value, and reprinted.
    const commitKey = (key: string, next: unknown) => {
      const current = objectValue[key];

      if (Object.is(next, current)) {
        return;
      }

      const edited =
        isEditablePrimitive(next) && isEditablePrimitive(current)
          ? setEditableValue(rawValue, [key], next)
          : typeof next === 'string' &&
              typeof current === 'object' &&
              current !== null
            ? setEditableSource(rawValue, [key], next)
            : null;

      onChange(
        edited !== null && edited !== rawValue
          ? edited
          : { ...objectValue, [key]: next },
      );
    };

    return (
      <div className={styles.object}>
        {Object.entries(objectValue).map(([key, val]) => {
          const nested = resolveRenderEntry(binding.render, key);

          return (
            <div key={key} className={styles.stack}>
              <LabeledField
                binding={{ ...nested, value: val }}
                labelClassName={styles.label}
                label={nested.label}
              >
                <Field
                  binding={{
                    ...toBindingFields(nested),
                    id,
                    value: val,
                    rawValue:
                      typeof val === 'object' && val !== null
                        ? (getEditableSource(rawValue, [key]) ??
                          JSON.stringify(val))
                        : String(val),
                    onChange: next => commitKey(key, next),
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
        className={styles.checkbox}
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
        className={styles.control}
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
          className={styles.control}
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
          className={styles.control}
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
          className={styles.control}
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
        className={styles.control}
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
