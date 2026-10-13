import { describe, expect, it } from 'vitest';

import type { BindingItem } from './types';
import { validateBindingValue } from './validate';

const makeBinding = (overrides: Partial<BindingItem> = {}): BindingItem => ({
  label: 'Test',
  property: 'test',
  ...overrides,
});

describe('validateBindingValue', () => {
  it('is valid when no constraints are set', () => {
    expect(validateBindingValue(makeBinding(), 'anything')).toEqual({
      valid: true,
    });
  });

  it('is valid for an empty value when not required', () => {
    expect(validateBindingValue(makeBinding(), '')).toEqual({ valid: true });
    expect(validateBindingValue(makeBinding(), null)).toEqual({
      valid: true,
    });
    expect(validateBindingValue(makeBinding(), undefined)).toEqual({
      valid: true,
    });
  });

  it('fails for an empty value when required', () => {
    const result = validateBindingValue(makeBinding({ required: true }), '');

    expect(result.valid).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it('passes required when a non-empty value is present', () => {
    expect(
      validateBindingValue(makeBinding({ required: true }), 'hello'),
    ).toEqual({ valid: true });
  });

  it('fails when a number is below min', () => {
    const result = validateBindingValue(makeBinding({ min: 10 }), 5);

    expect(result.valid).toBe(false);
    expect(result.message).toContain('10');
  });

  it('fails when a number is above max', () => {
    const result = validateBindingValue(makeBinding({ max: 100 }), 150);

    expect(result.valid).toBe(false);
    expect(result.message).toContain('100');
  });

  it('passes when a number is within min/max bounds', () => {
    expect(validateBindingValue(makeBinding({ min: 0, max: 10 }), 5)).toEqual({
      valid: true,
    });
  });

  it('fails when a string does not match the pattern', () => {
    const result = validateBindingValue(
      makeBinding({ pattern: '^[0-9]+$' }),
      'abc',
    );

    expect(result.valid).toBe(false);
  });

  it('passes when a string matches the pattern', () => {
    expect(
      validateBindingValue(makeBinding({ pattern: '^[0-9]+$' }), '12345'),
    ).toEqual({ valid: true });
  });

  it('treats a malformed pattern as non-blocking rather than throwing', () => {
    const result = validateBindingValue(
      makeBinding({ pattern: '(unclosed' }),
      'anything',
    );

    expect(() =>
      validateBindingValue(makeBinding({ pattern: '(unclosed' }), 'anything'),
    ).not.toThrow();
    expect(result).toEqual({ valid: true });
  });

  it('does not apply min/max to non-number values', () => {
    expect(
      validateBindingValue(makeBinding({ min: 10, max: 20 }), 'not-a-number'),
    ).toEqual({ valid: true });
  });

  // Since #238, PanelBinding.value is delivered as its real JS type, so a
  // `type: 'number'` binding passes an actual number here. min/max no longer
  // coerce a numeric string — a string is not range-checked, only compared
  // by pattern/url/date rules. The number cases above are the live path.
  it('does not range-check a numeric string (no coercion)', () => {
    expect(validateBindingValue(makeBinding({ min: 10 }), '5')).toEqual({
      valid: true,
    });
    expect(validateBindingValue(makeBinding({ max: 100 }), '150')).toEqual({
      valid: true,
    });
  });

  it('does not apply min/max to a whitespace-only string', () => {
    expect(
      validateBindingValue(makeBinding({ min: 10, max: 20 }), '   '),
    ).toEqual({ valid: true });
  });

  it('does not apply pattern to non-string values', () => {
    expect(
      validateBindingValue(makeBinding({ pattern: '^[0-9]+$' }), 42),
    ).toEqual({ valid: true });
  });

  it('fails for an invalid URL when type is url', () => {
    const result = validateBindingValue(
      makeBinding({ type: 'url' }),
      'not a url',
    );

    expect(result.valid).toBe(false);
  });

  it('passes for a valid URL when type is url', () => {
    expect(
      validateBindingValue(makeBinding({ type: 'url' }), 'https://example.com'),
    ).toEqual({ valid: true });
  });

  it('fails for an invalid date when type is date', () => {
    const result = validateBindingValue(
      makeBinding({ type: 'date' }),
      'not a date',
    );

    expect(result.valid).toBe(false);
  });

  it('passes for a valid date when type is date', () => {
    expect(
      validateBindingValue(makeBinding({ type: 'date' }), '2026-01-01'),
    ).toEqual({ valid: true });
  });

  // Strict `YYYY-MM-DD`, the format the date picker writes (#629).
  it.each(['1', '2026/10/13', '2026-02-30', '2026-13-01', '2026-10-13T10:00'])(
    'fails the date %s',
    value => {
      expect(
        validateBindingValue(makeBinding({ type: 'date' }), value),
      ).toEqual({ valid: false, message: 'Must be a valid date.' });
    },
  );

  it('passes a leap day only in a leap year', () => {
    const binding = makeBinding({ type: 'date' });

    expect(validateBindingValue(binding, '2028-02-29').valid).toBe(true);
    expect(validateBindingValue(binding, '2026-02-29').valid).toBe(false);
  });

  it.each(['a@b.co', 'first.last+tag@sub.example.com'])(
    'passes the email %s',
    value => {
      expect(
        validateBindingValue(makeBinding({ type: 'email' }), value).valid,
      ).toBe(true);
    },
  );

  it.each(['a', 'a@b', 'a b@c.d', 'a@@b.c'])('fails the email %s', value => {
    expect(validateBindingValue(makeBinding({ type: 'email' }), value)).toEqual(
      { valid: false, message: 'Must be a valid email address.' },
    );
  });

  it('checks no format for tel, only pattern', () => {
    expect(
      validateBindingValue(makeBinding({ type: 'tel' }), 'call me').valid,
    ).toBe(true);
    expect(
      validateBindingValue(
        makeBinding({ type: 'tel', pattern: '^[0-9-]+$' }),
        'call me',
      ).valid,
    ).toBe(false);
  });
});

describe('validateBindingValue constraints (#629)', () => {
  it('checks minLength and maxLength in characters', () => {
    const binding = makeBinding({ minLength: 2, maxLength: 3 });

    expect(validateBindingValue(binding, 'a')).toEqual({
      valid: false,
      message: 'Must be at least 2 characters.',
    });
    expect(validateBindingValue(binding, 'abcd')).toEqual({
      valid: false,
      message: 'Must be at most 3 characters.',
    });
    expect(validateBindingValue(binding, 'abc').valid).toBe(true);
    // One emoji, two UTF-16 code units.
    expect(
      validateBindingValue(makeBinding({ maxLength: 1 }), '😀').valid,
    ).toBe(true);
  });

  it('does not check the length of an empty value unless required', () => {
    expect(validateBindingValue(makeBinding({ minLength: 2 }), '').valid).toBe(
      true,
    );
  });

  it('shows patternMessage instead of the pattern message', () => {
    expect(
      validateBindingValue(
        makeBinding({ pattern: '^https://', patternMessage: 'Use https://' }),
        'http://a.b',
      ),
    ).toEqual({ valid: false, message: 'Use https://' });
  });

  it('checks step from min, or from 0 without one', () => {
    expect(validateBindingValue(makeBinding({ step: 1 }), 2.5)).toEqual({
      valid: false,
      message: 'Must be in steps of 1.',
    });
    expect(validateBindingValue(makeBinding({ step: 1 }), 3).valid).toBe(true);
    expect(
      validateBindingValue(makeBinding({ step: 2, min: 1 }), 5).valid,
    ).toBe(true);
    expect(
      validateBindingValue(makeBinding({ step: 2, min: 1 }), 4).valid,
    ).toBe(false);
  });

  it('accepts decimal steps despite floating-point error', () => {
    expect(validateBindingValue(makeBinding({ step: 0.1 }), 0.3).valid).toBe(
      true,
    );
    expect(validateBindingValue(makeBinding({ step: 0.1 }), 0.35).valid).toBe(
      false,
    );
  });

  it('checks minItems and maxItems on an array value', () => {
    const binding = makeBinding({ minItems: 2, maxItems: 3 });

    expect(validateBindingValue(binding, [1])).toEqual({
      valid: false,
      message: 'Must have at least 2 items.',
    });
    expect(validateBindingValue(binding, [1, 2, 3, 4])).toEqual({
      valid: false,
      message: 'Must have at most 3 items.',
    });
    expect(validateBindingValue(binding, [1, 2]).valid).toBe(true);
  });

  it('checks a date against minDate and maxDate', () => {
    const binding = makeBinding({
      type: 'date',
      minDate: '2026-01-01',
      maxDate: '2026-12-31',
    });

    expect(validateBindingValue(binding, '2025-12-31')).toEqual({
      valid: false,
      message: 'Must be on or after 2026-01-01.',
    });
    expect(validateBindingValue(binding, '2027-01-01')).toEqual({
      valid: false,
      message: 'Must be on or before 2026-12-31.',
    });
    expect(validateBindingValue(binding, '2026-01-01').valid).toBe(true);
    expect(validateBindingValue(binding, '2026-12-31').valid).toBe(true);
  });

  it('ignores a number min on a date, and minDate on a number', () => {
    expect(
      validateBindingValue(makeBinding({ type: 'date', min: 5 }), '2026-01-01')
        .valid,
    ).toBe(true);
    expect(
      validateBindingValue(
        makeBinding({ type: 'number', minDate: '2026-01-01' }),
        1,
      ).valid,
    ).toBe(true);
  });

  it('allows only the listed protocols, with or without the colon', () => {
    const binding = makeBinding({
      type: 'url',
      protocols: ['https:', 'MAILTO'],
    });

    expect(validateBindingValue(binding, 'javascript:alert(1)')).toEqual({
      valid: false,
      message: 'Must use https:, mailto:.',
    });
    expect(validateBindingValue(binding, 'https://a.b').valid).toBe(true);
    expect(validateBindingValue(binding, 'mailto:a@b.c').valid).toBe(true);
  });

  it('allows any protocol when protocols is unset or empty', () => {
    expect(
      validateBindingValue(makeBinding({ type: 'url' }), 'javascript:void(0)')
        .valid,
    ).toBe(true);
    expect(
      validateBindingValue(
        makeBinding({ type: 'url', protocols: [] }),
        'ftp://a.b',
      ).valid,
    ).toBe(true);
  });
});

// Translated messages for a host's own language (#524).
describe('validateBindingValue messages', () => {
  const binding = makeBinding({ required: true, max: 40 });

  it('returns the given messages, and the English default for the rest', () => {
    const messages = {
      required: '필수 항목입니다.',
      max: (max: number) => `최댓값은 ${max}입니다.`,
    };

    expect(validateBindingValue(binding, '', { messages }).message).toBe(
      '필수 항목입니다.',
    );
    expect(validateBindingValue(binding, 99, { messages }).message).toBe(
      '최댓값은 40입니다.',
    );
    expect(
      validateBindingValue(makeBinding({ type: 'url' }), 'nope', { messages })
        .message,
    ).toBe('Must be a valid URL.');
  });
});
