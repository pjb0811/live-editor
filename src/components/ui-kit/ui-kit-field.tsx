import type { ComponentProps } from 'react';

import {
  Checkbox,
  DatePicker,
  RichTextEditor,
  Select,
  TimePicker,
} from '@jbpark/ui-kit';

import { useLiveMessages } from '~/components/context/messages';
import FieldError from '~/components/dnd/panel/fields/field-error';
import { getFieldKind } from '~/components/dnd/panel/fields/field-kind';
import { useFieldState } from '~/components/dnd/panel/fields/use-field-state';
import type { FieldProps } from '~/components/dnd/panel/types';

import ColorPickerField from './color-picker-field';
import { formatDateValue, parseDateValue } from './date-value';

// The formatting controls for a small sidebar field, not every preset.
const RICHTEXT_TOOLBAR: ComponentProps<typeof RichTextEditor>['toolbar'] = [
  'bold',
  'italic',
  'underline',
  'bulletList',
  'orderedList',
  'link',
];

const UiKitField = ({ binding }: FieldProps) => {
  const messages = useLiveMessages();
  const { value, rawValue, onChange } = binding;
  const {
    validationError,
    errorId,
    controlProps,
    labelledByProps,
    commitIfChanged,
    validateAndCommit,
  } = useFieldState(binding);

  const kind = getFieldKind(binding);

  if (kind === 'richtext') {
    // Takes no `id`, so it points at the label instead.
    return (
      <RichTextEditor
        {...labelledByProps}
        value={rawValue}
        toolbar={RICHTEXT_TOOLBAR}
        onChange={commitIfChanged}
      />
    );
  }

  if (kind === 'boolean') {
    return (
      <Checkbox
        {...controlProps}
        checked={value === true || value === 'true'}
        onChange={checked => {
          onChange(checked);
        }}
      />
    );
  }

  if (kind === 'select') {
    const options = binding.options ?? [];
    // As in the built-in select: an empty choice for a function select with
    // no handler, or with a closed list (#741), and an unlisted current
    // value of a closed list shown but disabled (#769).
    const isUnlisted =
      rawValue !== '' && !options.some(option => option.value === rawValue);
    const choices = [
      ...(binding.type === 'function' &&
      (rawValue === '' || binding.optionsOnly)
        ? [{ label: messages.panel.noFunction, value: '' }]
        : []),
      ...(isUnlisted
        ? [
            {
              label: messages.panel.currentValue(rawValue),
              value: rawValue,
              disabled: true,
            },
          ]
        : []),
      ...options,
    ];

    // Takes no `id`, so it points at the label instead.
    return (
      <div>
        <Select
          {...labelledByProps}
          value={rawValue}
          options={choices}
          onChange={validateAndCommit}
        />
        <FieldError id={errorId} message={validationError} />
      </div>
    );
  }

  if (kind === 'color') {
    return (
      <ColorPickerField
        value={rawValue}
        label={binding.label}
        onChange={commitIfChanged}
      />
    );
  }

  if (kind === 'time') {
    return (
      <div>
        <TimePicker
          {...controlProps}
          value={rawValue || null}
          onChange={time => validateAndCommit(time ?? '')}
        />
        <FieldError id={errorId} message={validationError} />
      </div>
    );
  }

  const withTime = kind === 'datetime';

  return (
    <div>
      <DatePicker
        {...controlProps}
        value={parseDateValue(rawValue)}
        showTime={withTime}
        onChange={date =>
          validateAndCommit(date ? formatDateValue(date, withTime) : '')
        }
      />
      <FieldError id={errorId} message={validationError} />
    </div>
  );
};

export default UiKitField;
