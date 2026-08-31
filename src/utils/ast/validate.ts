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

  // `min`/`max` compare against a real number. Since #238, a `type:
  // 'number'` binding delivers an actual number across the panel boundary,
  // so callers pass one here directly — no string coercion to re-derive the
  // type. A non-number value simply isn't range-checked.
  if (typeof value === 'number') {
    if (binding.min !== undefined && value < binding.min) {
      return { valid: false, message: `Must be at least ${binding.min}.` };
    }
    if (binding.max !== undefined && value > binding.max) {
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
