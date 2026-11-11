import generate from '@babel/generator';
import { parse, parseExpression } from '@babel/parser';
import * as t from '@babel/types';

import { REGEX } from '../../constants';
import type { Attribute } from './types';

export const wrap = (code: string) => {
  return `<>${code}</>`;
};

export const unwrap = (generated: string) => {
  return generated
    .replace(/^<>\s*/g, '')
    .replace(/\s*<\/>\s*;?\s*$/g, '')
    .trim();
};

// Throws Babel's error when `code`, JSX such as a section's source, doesn't
// parse. Strict, like the document parse, unlike `extract()`, which recovers
// from errors.
export const assertJsxParses = (code: string) => {
  parse(wrap(code), {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
};

export const attrValue = ({
  value,
  isStringLiteral,
}: Attribute): t.JSXAttribute['value'] => {
  if (value === null) {
    return null;
  }

  if (isStringLiteral) {
    return t.stringLiteral(value);
  }

  const trimmed = value.trim();

  if (REGEX.NUMBER.test(trimmed)) {
    const magnitude = t.numericLiteral(Math.abs(parseFloat(trimmed)));

    // A negative is `-n`: Babel rejects a negative `numericLiteral` (#712).
    return t.jsxExpressionContainer(
      trimmed.startsWith('-') ? t.unaryExpression('-', magnitude) : magnitude,
    );
  }

  if (REGEX.BOOLEAN_OR_NULL.test(trimmed)) {
    const expr = parseExpression(trimmed, {
      plugins: ['jsx', 'typescript'],
    });
    return t.jsxExpressionContainer(expr);
  }

  try {
    const expr = parseExpression(trimmed, {
      plugins: ['jsx', 'typescript'],
    });
    return t.jsxExpressionContainer(expr);
  } catch {
    return t.stringLiteral(trimmed);
  }
};

export const generateCode = (node: t.Node): string => {
  return generate(node, { jsescOption: { minimal: true } }).code;
};
