import type { BindingItem } from './types';

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

const VALID: ValidationResult = { valid: true };

export const validateBindingValue = (
  binding: BindingItem,
  value: unknown,
): ValidationResult => {
  const isEmpty = value === '' || value === null || value === undefined;

  if (isEmpty) {
    if (binding.required) {
      return { valid: false, message: 'This field is required.' };
    }
    return VALID;
  }

  // `PanelBinding.value` (the value a custom renderPanel gets) is always a
  // string, even for `type: 'number'` bindings — coerce a numeric string
  // the same way the built-in field does today (see field.tsx's ad-hoc
  // `Number(next)`), so min/max apply to both callers instead of silently
  // no-op'ing on the string form. A non-numeric string (`NaN`) or
  // whitespace-only string is left alone; `isEmpty` above already handles
  // the plain empty-string case.
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' &&
          value.trim() !== '' &&
          !Number.isNaN(Number(value))
        ? Number(value)
        : undefined;

  if (numericValue !== undefined) {
    if (binding.min !== undefined && numericValue < binding.min) {
      return { valid: false, message: `Must be at least ${binding.min}.` };
    }
    if (binding.max !== undefined && numericValue > binding.max) {
      return { valid: false, message: `Must be at most ${binding.max}.` };
    }
  }

  if (typeof value === 'string' && binding.pattern) {
    let regex: RegExp;

    try {
      regex = new RegExp(binding.pattern);
    } catch {
      // Malformed pattern authored on the binding itself — don't block the
      // user's input for an authoring mistake that isn't theirs to fix.
      return VALID;
    }

    if (!regex.test(value)) {
      return {
        valid: false,
        message: 'Value does not match the required format.',
      };
    }
  }

  if (typeof value === 'string' && binding.type === 'url') {
    try {
      new URL(value);
    } catch {
      return { valid: false, message: 'Must be a valid URL.' };
    }
  }

  if (typeof value === 'string' && binding.type === 'date') {
    if (Number.isNaN(Date.parse(value))) {
      return { valid: false, message: 'Must be a valid date.' };
    }
  }

  return VALID;
};
