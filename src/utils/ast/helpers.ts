import generate from '@babel/generator';
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';

import { REGEX } from '../../enums';
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
    return t.jsxExpressionContainer(t.numericLiteral(parseFloat(trimmed)));
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
