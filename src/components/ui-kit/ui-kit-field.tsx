import type { ComponentProps } from 'react';

import {
  Checkbox,
  DatePicker,
  RichTextEditor,
  Select,
  TimePicker,
} from '@jbpark/ui-kit';

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
    // Takes no `id`, so it points at the label instead.
    return (
      <Select
        {...labelledByProps}
        value={rawValue}
        options={binding.options ?? []}
        onChange={commitIfChanged}
      />
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
