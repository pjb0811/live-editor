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
  time: string;
  datetime: string;
  email: string;
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
  time: 'Must be a valid time.',
  datetime: 'Must be a valid date and time.',
  email: 'Must be a valid email address.',
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

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// A 24-hour `HH:mm`, the format the built-in time picker writes.
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// `YYYY-MM-DDTHH:mm` in local time with no zone, as `datetime-local` writes
// it, naming a day that exists.
const isDateTime = (value: string) => {
  const [date, time, ...rest] = value.split('T');

  return (
    rest.length === 0 &&
    date !== undefined &&
    time !== undefined &&
    isCalendarDate(date) &&
    TIME.test(time)
  );
};

// Compares a date or date-time with a `minDate`/`maxDate` bound at the
// coarser of the two, so a date-only bound covers that whole day. The
// formats sort by time, so they compare as text.
const compareToBound = (value: string, bound: string) => {
  const length = Math.min(value.length, bound.length);
  const a = value.slice(0, length);
  const b = bound.slice(0, length);

  return a < b ? -1 : a > b ? 1 : 0;
};

// A basic `local@domain.tld` check: no spaces, one `@`, a dot in the domain.
// Anything stricter rejects real addresses.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// `YYYY-MM-DD` naming a day that exists, so `2026-02-30` fails. This is the
// format the built-in date picker writes.
const isCalendarDate = (value: string) => {
  const match = ISO_DATE.exec(value);

  if (!match) {
    return false;
  }

  const [year, month, day] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

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

  if (typeof value === 'string' && binding.type === 'time') {
    if (!TIME.test(value)) {
      return invalid(messages.time);
    }
  }

  if (
    typeof value === 'string' &&
    (binding.type === 'date' || binding.type === 'datetime')
  ) {
    if (binding.type === 'date' && !isCalendarDate(value)) {
      return invalid(messages.date);
    }

    if (binding.type === 'datetime' && !isDateTime(value)) {
      return invalid(messages.datetime);
    }

    if (
      binding.minDate !== undefined &&
      compareToBound(value, binding.minDate) < 0
    ) {
      return invalid(messages.minDate(binding.minDate));
    }

    if (
      binding.maxDate !== undefined &&
      compareToBound(value, binding.maxDate) > 0
    ) {
      return invalid(messages.maxDate(binding.maxDate));
    }
  }

  if (
    typeof value === 'string' &&
    binding.type === 'email' &&
    !EMAIL.test(value)
  ) {
    return invalid(messages.email);
  }

  return VALID;
};
