import { createContext, useContext, useId } from 'react';

import type { FieldKind } from './field-kind';

// The ids a `LabeledField` gives the field inside it: the control's, which
// the label's `htmlFor` points at, and the label's own, for a control that
// can't take an id and points back with `aria-labelledby` (#637).
export const FieldIdsContext = createContext<{
  controlId: string;
  labelId: string;
} | null>(null);

// The ids a built-in control carries: its own, for the label's `htmlFor`,
// its label's, for `aria-labelledby`, and its error message's, for
// `aria-describedby`. `isLabelled` is false outside a `LabeledField`, such
// as in a custom panel's own markup, where the control names itself with
// `aria-label` instead.
export const useFieldIds = () => {
  const labelledIds = useContext(FieldIdsContext);

  const fallbackId = useId();

  const controlId = labelledIds?.controlId ?? fallbackId;

  return {
    controlId,
    labelId: labelledIds?.labelId,
    errorId: `${controlId}-error`,
    isLabelled: labelledIds !== null,
  };
};

// The built-in controls that take an `id`, so a label can point at them.
export const LABELABLE_KINDS: ReadonlySet<FieldKind> = new Set([
  'text',
  'number',
  'url',
  'email',
  'tel',
  'time',
  'date',
  'datetime',
  'boolean',
]);

// The built-in controls that take no `id` but take `aria-labelledby`, so
// they point at their label instead.
export const LABELLED_BY_KINDS: ReadonlySet<FieldKind> = new Set([
  'select',
  'richtext',
]);
