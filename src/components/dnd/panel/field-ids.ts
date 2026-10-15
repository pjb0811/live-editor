import { createContext, useContext, useId } from 'react';

import type { FieldKind } from './field-kind';

// The id of the control a `LabeledField`'s label points at, read by the
// field inside it (#637).
export const FieldIdsContext = createContext<string | null>(null);

// The ids a built-in control carries: its own, for the label's `htmlFor`,
// and its error message's, for `aria-describedby`. `isLabelled` is false
// outside a `LabeledField`, such as in a custom panel's own markup, where
// the control names itself with `aria-label` instead.
export const useFieldIds = () => {
  const fallbackId = useId();
  const labelledId = useContext(FieldIdsContext);
  const controlId = labelledId ?? fallbackId;

  return {
    controlId,
    errorId: `${controlId}-error`,
    isLabelled: labelledId !== null,
  };
};

// The built-in controls that take an `id`, so a label can point at them.
// The others (select, date and color pickers, checkbox, the editors) name
// themselves where they can, until ui-kit lets them take one.
export const LABELABLE_KINDS: ReadonlySet<FieldKind> = new Set([
  'text',
  'number',
  'url',
  'email',
  'tel',
  'time',
]);
