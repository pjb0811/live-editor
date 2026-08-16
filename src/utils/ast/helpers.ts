import _generate from '@babel/generator';
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';

import { REGEX } from '../../constants';
import type { Attribute } from './types';

// Same @babel/* CJS/ESM interop issue as document.ts's traverse import:
// @babel/generator's CJS build re-exports itself as `{ default: generate,
// generate, CodeGenerator }`, and Vite's browser dependency pre-bundling
// doesn't unwrap that inner `.default` again — `generate` resolved to the
// whole exports object, not the function. Every generateCode() call threw,
// which extract.ts's extractAttributes() silently swallows into a `null`
// attribute value, and update.ts's callers surface as "Failed to parse/
// update this section" toasts.
const generate =
  typeof _generate === 'function'
    ? _generate
    : (_generate as unknown as { default: typeof _generate }).default;

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
