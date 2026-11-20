import { useLiveMessages } from '~/components/context/messages';
import {
  getEditableSource,
  isEditablePrimitive,
  objectEntrySources,
  setEditableExpression,
  setEditableSource,
  setEditableValue,
} from '~/utils/ast/editable-value';
import {
  isFunctionBindingSource,
  isFunctionSource,
} from '~/utils/ast/function-source';
import { type DataAttrNode } from '~/utils/ast/types';
import { parseValue } from '~/utils/ast/value';
import { cn } from '~/utils/cn';

import styles from './fields/fields.module.css';

import { useDndEditOptions } from '../edit-options';
import {
  type PanelBinding,
  resolveRenderEntry,
  toBindingFields,
} from '../panel-binding';
import Children from './children/children';
import ColorField from './fields/color-field';
import FieldError from './fields/field-error';
import { getFieldKind } from './fields/field-kind';
import ImageField from './fields/image-field';
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
  const { panelLayout, reportError } = useDndEditOptions();
  const { id, value, rawValue, onChange } = binding;
  const fieldState = useFieldState(binding);
  const {
    text,
    setText,
    validationError,
    errorId,
    controlProps,
    commitIfChanged,
    validateAndCommit,
  } = fieldState;

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

  if (kind === 'function') {
    // Checked like any text value, so `pattern`, `minLength`, `maxLength`
    // and `required` apply (#769).
    return (
      <div>
        <JSXEditorField value={rawValue} raw onSave={validateAndCommit} />
        <FieldError id={errorId} message={validationError} />
      </div>
    );
  }

  if (kind === 'html' || kind === 'jsx') {
    return (
      <JSXEditorField
        value={rawValue}
        raw={kind !== 'jsx'}
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
    // Every key as written, functions and references included, which
    // `value` leaves out. `null` when the source can't be read key by key;
    // then only `value`'s keys are shown (#768).
    const entries = objectEntrySources(rawValue);
    const keys = entries
      ? entries.map(entry => entry.key)
      : Object.keys(objectValue);
    // A key `value` can't hold. While there is one, the object can't be
    // reprinted from `value` without losing it.
    const hasExpressionKey =
      entries?.some(entry => !Object.hasOwn(objectValue, entry.key)) ?? false;

    const refuse = (key: string, label: string) =>
      reportError({
        type: 'update',
        id,
        label,
        property: key,
        failure: { reason: 'invalid-function', dataId: id, property: key },
        title: messages.editErrors.cannotEdit(label),
        description: messages.editErrors.invalidFunction(key),
      });

    // Commits an edit to one key as the object's source with only that key's
    // value replaced, so the rest stays as written (#722). A nested object or
    // array editor commits its own source, which goes in that key's place.
    // When the source can't be edited in place, the whole object is
    // committed as a value and reprinted, unless that would drop a key
    // `value` doesn't hold.
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

      if (edited !== null && edited !== rawValue) {
        onChange(edited);

        return;
      }

      if (!hasExpressionKey) {
        onChange({ ...objectValue, [key]: next });
      }
    };

    // A function key takes new source as given, as a function attribute
    // does, and refuses anything else (#741, #768).
    const commitFunctionKey = (key: string, label: string, next: unknown) => {
      const source = typeof next === 'string' ? next.trim() : '';
      const edited = isFunctionSource(source)
        ? setEditableExpression(rawValue, [key], source)
        : null;

      if (edited === null) {
        refuse(key, label);

        return;
      }

      if (edited !== rawValue) {
        onChange(edited);
      }
    };

    return (
      <div className={styles.object}>
        {keys.map(key => {
          const nested = resolveRenderEntry(binding.render, key);
          const source = entries?.find(entry => entry.key === key)?.source;
          const val = objectValue[key];
          const isFunction =
            source !== undefined &&
            isFunctionBindingSource(nested.type, source);
          const nestedBinding: PanelBinding = isFunction
            ? {
                ...toBindingFields(nested),
                type: 'function',
                id,
                value: source,
                rawValue: source,
                onChange: next => commitFunctionKey(key, nested.label, next),
              }
            : Object.hasOwn(objectValue, key)
              ? {
                  ...toBindingFields(nested),
                  id,
                  value: val,
                  rawValue:
                    typeof val === 'object' && val !== null
                      ? (getEditableSource(rawValue, [key]) ??
                        JSON.stringify(val))
                      : String(val),
                  onChange: next => commitKey(key, next),
                }
              : // An expression that isn't a function, such as a call or an
                // untyped reference: shown as written, on its own.
                {
                  ...toBindingFields(nested),
                  id,
                  value: source,
                  rawValue: source ?? '',
                  canEditValue: false,
                  onChange: () => {},
                };

          return (
            <div key={key} className={styles.stack}>
              <LabeledField
                binding={nestedBinding}
                labelClassName={styles.label}
                label={nested.label}
                description={panelLayout?.describe?.(nestedBinding)}
              >
                <Field binding={nestedBinding} onNodeChange={onNodeChange} />
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
    const options = binding.options ?? [];
    // An `optionsOnly` select can hold a value written elsewhere, such as in
    // the code editor. It's shown, but can't be chosen again (#769).
    const isUnlisted =
      rawValue !== '' && !options.some(option => option.value === rawValue);

    return (
      <div>
        <select
          {...controlProps}
          value={rawValue}
          className={styles.control}
          onChange={e => validateAndCommit(e.target.value)}
        >
          {/* No handler set: choosing this removes the attribute (#741). */}
          {binding.type === 'function' &&
            (rawValue === '' || binding.optionsOnly) && (
              <option value="">{messages.panel.noFunction}</option>
            )}
          {isUnlisted && (
            <option value={rawValue} disabled>
              {messages.panel.currentValue(rawValue)}
            </option>
          )}
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError id={errorId} message={validationError} />
      </div>
    );
  }

  if (kind === 'image') {
    return <ImageField binding={binding} state={fieldState} />;
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
