import type { BindingItem } from './types';

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

// The messages a failed check returns. Pass your own through `options` to
// translate them; the built-in panel passes the provider's `validation`
// messages (#524).
export interface ValidationMessages {
  required: string;
  min: (min: number) => string;
  max: (max: number) => string;
  pattern: string;
  url: string;
  date: string;
}

export const defaultValidationMessages: ValidationMessages = {
  required: 'This field is required.',
  min: min => `Must be at least ${min}.`,
  max: max => `Must be at most ${max}.`,
  pattern: 'Value does not match the required format.',
  url: 'Must be a valid URL.',
  date: 'Must be a valid date.',
};

export interface ValidationOptions {
  messages?: Partial<ValidationMessages>;
}

const VALID: ValidationResult = { valid: true };

export const validateBindingValue = (
  binding: BindingItem,
  value: unknown,
  options: ValidationOptions = {},
): ValidationResult => {
  const messages = { ...defaultValidationMessages, ...options.messages };
  const isEmpty = value === '' || value === null || value === undefined;

  if (isEmpty) {
    if (binding.required) {
      return { valid: false, message: messages.required };
    }
    return VALID;
  }

  // `min`/`max` compare against a real number. Since #238, a `type:
  // 'number'` binding delivers an actual number across the panel boundary,
  // so callers pass one here directly — no string coercion to re-derive the
  // type. A non-number value simply isn't range-checked.
  if (typeof value === 'number') {
    if (binding.min !== undefined && value < binding.min) {
      return { valid: false, message: messages.min(binding.min) };
    }
    if (binding.max !== undefined && value > binding.max) {
      return { valid: false, message: messages.max(binding.max) };
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
        message: messages.pattern,
      };
    }
  }

  if (typeof value === 'string' && binding.type === 'url') {
    try {
      new URL(value);
    } catch {
      return { valid: false, message: messages.url };
    }
  }

  if (typeof value === 'string' && binding.type === 'date') {
    if (Number.isNaN(Date.parse(value))) {
      return { valid: false, message: messages.date };
    }
  }

  return VALID;
};
