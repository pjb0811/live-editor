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

  return VALID;
};
