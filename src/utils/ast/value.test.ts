import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { describe, expect, it, vi } from 'vitest';

import { generateCode } from './helpers';
import {
  arrayExpressionToCode,
  createNodeFromValue,
  extractNodeValue,
  extractObjectProperties,
  parseArrayExpression,
  parseValue,
} from './value';

describe('parseValue', () => {
  it('parses integer and float strings as numbers', () => {
    expect(parseValue('42')).toBe(42);
    expect(parseValue('3.14')).toBe(3.14);
  });

  it('parses boolean/null/undefined literals', () => {
    expect(parseValue('true')).toBe(true);
    expect(parseValue('false')).toBe(false);
    expect(parseValue('null')).toBeNull();
    expect(parseValue('undefined')).toBeUndefined();
  });

  it('returns empty or whitespace-only strings unchanged', () => {
    expect(parseValue('')).toBe('');
    expect(parseValue('   ')).toBe('   ');
  });

  it('parses an object literal string into a real object', () => {
    expect(parseValue('{a: 1, b: "x"}')).toEqual({ a: 1, b: 'x' });
  });

  it('round-trips JSON.stringify output (string-literal keys) without losing properties', () => {
    const original = [
      { tagName: 'div', attributes: { id: 'x' }, children: [] },
    ];

    expect(parseValue(JSON.stringify(original))).toEqual(original);
  });

  it('parses an array literal string into a real array', () => {
    expect(parseValue('[1, "x", true]')).toEqual([1, 'x', true]);
  });

  it('maps array elisions to null', () => {
    expect(parseValue('[1, , 3]')).toEqual([1, null, 3]);
  });

  it('never executes side-effecting expressions embedded in object/array-shaped strings', () => {
    delete (globalThis as Record<string, unknown>).__pwned;

    try {
      parseValue('{x: (globalThis.__pwned = true, 1)}');
      expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined();
    } finally {
      delete (globalThis as Record<string, unknown>).__pwned;
    }
  });

  it('falls back to the original string for malformed object/array-shaped input', () => {
    expect(parseValue('{a: 1,')).toBe('{a: 1,');
  });

  it('falls back to the original string for plain non-literal text', () => {
    expect(parseValue('hello world')).toBe('hello world');
  });

  it('serializes JSX inside object property values back to a code string', () => {
    const result = parseValue('{a: <div>hi</div>}') as Record<string, unknown>;
    const expected = generateCode(
      parseExpression('<div>hi</div>', { plugins: ['jsx'] }),
    );

    expect(result.a).toBe(expected);
  });
});

describe('extractNodeValue', () => {
  it('extracts boolean literals', () => {
    expect(extractNodeValue(t.booleanLiteral(true))).toEqual({
      type: 'boolean',
      value: true,
    });
  });

  it('extracts numeric literals', () => {
    expect(extractNodeValue(t.numericLiteral(5))).toEqual({
      type: 'number',
      value: 5,
    });
  });

  it('extracts negative numeric literals', () => {
    const node = parseExpression('-5');
    expect(extractNodeValue(node)).toEqual({
      type: 'number',
      value: -5,
    });
  });

  it('extracts string literals', () => {
    expect(extractNodeValue(t.stringLiteral('hi'))).toEqual({
      type: 'string',
      value: 'hi',
    });
  });

  it('extracts static template literals as dedented strings', () => {
    const node = parseExpression('`hello`');
    expect(extractNodeValue(node)).toEqual({
      type: 'string',
      value: 'hello',
    });
  });

  it('extracts template literals with expressions as generated code', () => {
    const node = parseExpression('`hello ${name}`');
    expect(extractNodeValue(node)).toEqual({
      type: 'string',
      value: generateCode(node),
    });
  });

  it('extracts null literals', () => {
    expect(extractNodeValue(t.nullLiteral())).toEqual({
      type: 'null',
      value: null,
    });
  });

  it('extracts array expressions as generated code', () => {
    const node = parseExpression('[1, 2, 3]');
    expect(extractNodeValue(node)).toEqual({
      type: 'array',
      value: generateCode(node),
    });
  });

  it('extracts object expressions as generated code', () => {
    const node = parseExpression('{a: 1}');
    expect(extractNodeValue(node)).toEqual({
      type: 'object',
      value: generateCode(node),
    });
  });

  it('extracts JSX elements as generated code', () => {
    const node = parseExpression('<div />', { plugins: ['jsx'] });
    expect(extractNodeValue(node)).toEqual({
      type: 'string',
      value: generateCode(node),
    });
  });

  it('extracts JSX fragments as generated code', () => {
    const node = parseExpression('<>hi</>', { plugins: ['jsx'] });
    expect(extractNodeValue(node)).toEqual({
      type: 'string',
      value: generateCode(node),
    });
  });

  it('returns unknown for unsupported node types', () => {
    expect(extractNodeValue(t.identifier('x'))).toEqual({
      type: 'unknown',
      value: null,
    });
  });
});

describe('createNodeFromValue', () => {
  it('round-trips a boolean value through generateCode', () => {
    const node = createNodeFromValue('boolean', true);
    expect(node).not.toBeNull();
    expect(generateCode(node!)).toBe('true');
  });

  it('round-trips a number value through generateCode', () => {
    const node = createNodeFromValue('number', 42);
    expect(node).not.toBeNull();
    expect(generateCode(node!)).toBe('42');
  });

  it('round-trips a string value through generateCode', () => {
    const node = createNodeFromValue('string', 'hi');
    expect(node).not.toBeNull();
    expect(generateCode(node!)).toBe('"hi"');
  });

  it('creates a null literal node for the null type', () => {
    const node = createNodeFromValue('null', null);
    expect(node).not.toBeNull();
    expect(generateCode(node!)).toBe('null');
  });

  it('returns null for array/object/unknown types', () => {
    expect(createNodeFromValue('array', [1, 2])).toBeNull();
    expect(createNodeFromValue('object', { a: 1 })).toBeNull();
    expect(createNodeFromValue('unknown', 'anything')).toBeNull();
  });
});

describe('parseArrayExpression', () => {
  it('parses a valid array literal string into an ArrayExpression node', () => {
    const result = parseArrayExpression('[1, 2, 3]');
    expect(result).not.toBeNull();
    expect(t.isArrayExpression(result)).toBe(true);
  });

  it('returns null for non-array expression input', () => {
    expect(parseArrayExpression('{a: 1}')).toBeNull();
  });

  it('returns null and logs an error for malformed syntax', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(parseArrayExpression('[1, 2,')).toBeNull();
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('extractObjectProperties', () => {
  it('extracts identifier-keyed properties and skips the children key', () => {
    const ast = parseExpression('{a: 1, children: <div />, b: "x"}', {
      plugins: ['jsx'],
    }) as t.ObjectExpression;

    const properties = extractObjectProperties(ast);

    expect(Object.keys(properties).sort()).toEqual(['a', 'b']);
    expect(properties.a).toMatchObject({ type: 'number', value: 1 });
    expect(properties.b).toMatchObject({ type: 'string', value: 'x' });
  });
});

describe('arrayExpressionToCode', () => {
  it('generates array-literal code from a list of object expressions', () => {
    const elements = [
      parseExpression('{a: 1}') as t.ObjectExpression,
      parseExpression('{b: 2}') as t.ObjectExpression,
    ];

    const code = arrayExpressionToCode(elements);

    expect(code).toBe(generateCode(t.arrayExpression(elements)));
    expect(code).toContain('a: 1');
    expect(code).toContain('b: 2');
  });
});
