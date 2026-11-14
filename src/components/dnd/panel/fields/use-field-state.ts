import { useState } from 'react';

import { useLiveMessages } from '~/components/context/messages';
import { validateBindingValue } from '~/utils/ast/validate';

import type { PanelBinding } from '../../panel-binding';
import { useFieldIds } from './field-ids';

// What a field control needs besides the binding: the text being typed,
// the validation error, the ids and aria props that tie the control to its
// label and error, and the two ways to commit. Shared by the built-in
// controls and the ui-kit ones (`@jbpark/live-editor/ui-kit`).
export const useFieldState = (binding: PanelBinding) => {
  const messages = useLiveMessages();
  // `value` is the JS value; `rawValue` is the source text, for the text
  // controls and the source editors (#238).
  const { value, rawValue, onChange } = binding;

  const [validationError, setValidationError] = useState<string | null>(null);
  const { controlId, labelId, errorId, descriptionId, isLabelled } =
    useFieldIds();

  // What the user is typing, for the inputs that commit on blur (url,
  // number, text area). Reset during render when `rawValue` changes from
  // outside, such as undo, so the old text isn't committed on blur (#284).
  const [text, setText] = useState(rawValue);
  const [prevRawValue, setPrevRawValue] = useState(rawValue);

  if (rawValue !== prevRawValue) {
    setPrevRawValue(rawValue);
    setText(rawValue);
  }

  // The field's description and its error, once there is one (#637,
  // #753).
  const describedBy =
    [descriptionId, validationError ? errorId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

  // For the controls that take an id: the id the label points at, a name
  // of their own outside a `LabeledField`, and what describes them.
  const controlProps = {
    id: controlId,
    'aria-label': isLabelled ? undefined : binding.label,
    'aria-invalid': validationError ? true : undefined,
    'aria-describedby': describedBy,
  };
  // For the controls that take no id: the label they point at inside a
  // `LabeledField`, or a name of their own outside one.
  const labelledByProps = {
    'aria-label': labelId ? undefined : binding.label,
    'aria-labelledby': labelId,
    'aria-describedby': describedBy,
  };

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
    const result = validateBindingValue(binding, next, {
      messages: messages.validation,
    });

    if (!result.valid) {
      setValidationError(result.message ?? messages.panel.invalidValue);

      return;
    }

    setValidationError(null);
    commitIfChanged(next);
  };

  return {
    text,
    setText,
    validationError,
    errorId,
    controlProps,
    labelledByProps,
    commitIfChanged,
    validateAndCommit,
  };
};
