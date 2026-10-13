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
  minLength: (minLength: number) => string;
  maxLength: (maxLength: number) => string;
  step: (step: number) => string;
  minItems: (minItems: number) => string;
  maxItems: (maxItems: number) => string;
  minDate: (minDate: string) => string;
  maxDate: (maxDate: string) => string;
  // The allowed schemes, normalized to end with `:`.
  protocol: (protocols: string[]) => string;
}

export const defaultValidationMessages: ValidationMessages = {
  required: 'This field is required.',
  min: min => `Must be at least ${min}.`,
  max: max => `Must be at most ${max}.`,
  pattern: 'Value does not match the required format.',
  url: 'Must be a valid URL.',
  date: 'Must be a valid date.',
  minLength: minLength =>
    `Must be at least ${minLength} character${minLength === 1 ? '' : 's'}.`,
  maxLength: maxLength =>
    `Must be at most ${maxLength} character${maxLength === 1 ? '' : 's'}.`,
  step: step => `Must be in steps of ${step}.`,
  minItems: minItems =>
    `Must have at least ${minItems} item${minItems === 1 ? '' : 's'}.`,
  maxItems: maxItems =>
    `Must have at most ${maxItems} item${maxItems === 1 ? '' : 's'}.`,
  minDate: minDate => `Must be on or after ${minDate}.`,
  maxDate: maxDate => `Must be on or before ${maxDate}.`,
  protocol: protocols => `Must use ${protocols.join(', ')}.`,
};

export interface ValidationOptions {
  messages?: Partial<ValidationMessages>;
}

const VALID: ValidationResult = { valid: true };

// How close a number has to be to a whole number of steps, so `0.3` passes
// `step: 0.1` despite floating-point error.
const STEP_TOLERANCE = 1e-9;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// `'https'` and `'https:'` both name the scheme `URL.protocol` reports as
// `'https:'`.
const normalizeProtocol = (protocol: string) =>
  `${protocol.toLowerCase().replace(/:$/, '')}:`;

const invalid = (message: string): ValidationResult => ({
  valid: false,
  message,
});

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

  // `min` and `max` apply to numbers only; a `type: 'number'` field passes
  // a number (#238). Other values aren't range-checked.
  if (typeof value === 'number') {
    if (binding.min !== undefined && value < binding.min) {
      return { valid: false, message: messages.min(binding.min) };
    }
    if (binding.max !== undefined && value > binding.max) {
      return { valid: false, message: messages.max(binding.max) };
    }

    if (binding.step !== undefined && binding.step > 0) {
      const steps = (value - (binding.min ?? 0)) / binding.step;

      if (Math.abs(steps - Math.round(steps)) > STEP_TOLERANCE) {
        return invalid(messages.step(binding.step));
      }
    }
  }

  if (typeof value === 'string') {
    const length = [...value].length;

    if (binding.minLength !== undefined && length < binding.minLength) {
      return invalid(messages.minLength(binding.minLength));
    }

    if (binding.maxLength !== undefined && length > binding.maxLength) {
      return invalid(messages.maxLength(binding.maxLength));
    }
  }

  if (Array.isArray(value)) {
    if (binding.minItems !== undefined && value.length < binding.minItems) {
      return invalid(messages.minItems(binding.minItems));
    }

    if (binding.maxItems !== undefined && value.length > binding.maxItems) {
      return invalid(messages.maxItems(binding.maxItems));
    }
  }

  if (typeof value === 'string' && binding.pattern) {
    let regex: RegExp;

    try {
      regex = new RegExp(binding.pattern);
    } catch {
      // An invalid `pattern` is the binding's mistake, so don't block the
      // input.
      return VALID;
    }

    if (!regex.test(value)) {
      return invalid(binding.patternMessage ?? messages.pattern);
    }
  }

  if (typeof value === 'string' && binding.type === 'url') {
    let url: URL;

    try {
      url = new URL(value);
    } catch {
      return { valid: false, message: messages.url };
    }

    if (binding.protocols?.length) {
      const allowed = binding.protocols.map(normalizeProtocol);

      if (!allowed.includes(url.protocol)) {
        return invalid(messages.protocol(allowed));
      }
    }
  }

  if (typeof value === 'string' && binding.type === 'date') {
    if (Number.isNaN(Date.parse(value))) {
      return { valid: false, message: messages.date };
    }

    // `YYYY-MM-DD` strings sort by date, so they compare as text. A value in
    // another format isn't range-checked.
    if (ISO_DATE.test(value)) {
      if (binding.minDate !== undefined && value < binding.minDate) {
        return invalid(messages.minDate(binding.minDate));
      }

      if (binding.maxDate !== undefined && value > binding.maxDate) {
        return invalid(messages.maxDate(binding.maxDate));
      }
    }
  }

  return VALID;
};
