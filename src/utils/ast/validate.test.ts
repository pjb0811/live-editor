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

  it('does not apply pattern to non-string values', () => {
    expect(
      validateBindingValue(makeBinding({ pattern: '^[0-9]+$' }), 42),
    ).toEqual({ valid: true });
  });
});
