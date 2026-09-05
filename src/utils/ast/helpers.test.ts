import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { describe, expect, it } from 'vitest';

import { attrValue, generateCode, unwrap, wrap } from './helpers';

describe('wrap / unwrap', () => {
  it('wraps code in a fragment', () => {
    expect(wrap('<div />')).toBe('<><div /></>');
  });

  it('unwrap reverses wrap', () => {
    expect(unwrap(wrap('<div />'))).toBe('<div />');
  });

  it('unwrap strips a trailing semicolon and surrounding whitespace', () => {
    expect(unwrap('<>\n  <div />\n</>;')).toBe('<div />');
  });
});

describe('attrValue', () => {
  it('returns null for a null value', () => {
    expect(attrValue({ name: 'x', value: null })).toBeNull();
  });

  it('returns a string literal when isStringLiteral is set', () => {
    const result = attrValue({ name: 'x', value: '42', isStringLiteral: true });
    expect(t.isStringLiteral(result) && result.value).toBe('42');
  });

  it('wraps a numeric value in a numeric literal expression container', () => {
    const result = attrValue({ name: 'x', value: '3.5' });
    expect(t.isJSXExpressionContainer(result)).toBe(true);
    if (t.isJSXExpressionContainer(result)) {
      expect(
        t.isNumericLiteral(result.expression) && result.expression.value,
      ).toBe(3.5);
    }
  });

  it('parses boolean/null values as expressions', () => {
    const result = attrValue({ name: 'x', value: 'true' });
    expect(t.isJSXExpressionContainer(result)).toBe(true);
    if (t.isJSXExpressionContainer(result)) {
      expect(t.isBooleanLiteral(result.expression)).toBe(true);
    }
  });

  it('falls back to a string literal for unparsable expressions', () => {
    const result = attrValue({ name: 'x', value: 'not valid <<' });
    expect(t.isStringLiteral(result) && result.value).toBe('not valid <<');
  });
});

describe('generateCode', () => {
  it('serializes a parsed node back to source', () => {
    const node = parseExpression('<div className="x" />', {
      plugins: ['jsx', 'typescript'],
    });
    expect(generateCode(node)).toContain('<div className="x" />');
  });
});
