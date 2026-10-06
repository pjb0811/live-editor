import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';

import { REGEX } from '../../constants';
import { generateCode } from './helpers';
import type { ExtractedNodeValue } from './types';

// Reads values out of the AST without running code: literals, binding values
// and array or object expressions.

const dedent = (str: string): string => {
  const lines = str
    .replace(/^\n/, '')
    .replace(/\n\s*$/, '')
    .split('\n');

  const indent = lines.reduce((min, line) => {
    if (!line.trim()) {
      return min;
    }
    const match = line.match(/^(\s*)/);
    return Math.min(min, match?.[1]?.length ?? 0);
  }, Infinity);

  return indent === Infinity
    ? str.trim()
    : lines.map(line => line.slice(indent)).join('\n');
};

// Removes type-only wrappers (`satisfies`, `as const`, type assertions) and
// parentheses, so the literal underneath can be read. Without this, a
// `data-binding={[...] satisfies BindingItem[]}` would read as no bindings.
export const unwrapExpression = (node: t.Node): t.Node => {
  let current = node;

  while (
    t.isTSAsExpression(current) ||
    t.isTSSatisfiesExpression(current) ||
    t.isTSNonNullExpression(current) ||
    t.isTSTypeAssertion(current) ||
    t.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }

  return current;
};

// Whether `evaluateLiteral()` and `valueToExpression()` can round-trip the
// value without losing calls, references, spreads, holes or computed keys.
// The panel uses it to disable editors, and edits use it as the last check,
// so both agree on what is editable.
export const isLosslesslyEvaluable = (node: t.Node): boolean => {
  const value = unwrapExpression(node);

  if (
    t.isStringLiteral(value) ||
    t.isNumericLiteral(value) ||
    t.isBooleanLiteral(value) ||
    t.isNullLiteral(value)
  ) {
    return true;
  }

  if (
    t.isUnaryExpression(value) &&
    value.operator === '-' &&
    t.isNumericLiteral(value.argument)
  ) {
    return true;
  }

  if (t.isTemplateLiteral(value)) {
    return value.expressions.length === 0;
  }

  if (t.isArrayExpression(value)) {
    return value.elements.every(
      element => element !== null && isLosslesslyEvaluable(element),
    );
  }

  if (t.isObjectExpression(value)) {
    return value.properties.every(
      property =>
        t.isObjectProperty(property) &&
        !property.computed &&
        (t.isIdentifier(property.key) ||
          t.isStringLiteral(property.key) ||
          t.isNumericLiteral(property.key)) &&
        isLosslesslyEvaluable(property.value),
    );
  }

  return false;
};

export const canLosslesslyEvaluateSource = (source: string): boolean => {
  try {
    return isLosslesslyEvaluable(
      parseExpression(source, { plugins: ['jsx', 'typescript'] }),
    );
  } catch {
    return false;
  }
};

// Reads a literal's value from its AST without running any code. Calls,
// references and other non-literal expressions give `undefined`, so reading
// a field never executes the document's code.
export const evaluateLiteral = (rawNode: t.Node): unknown => {
  const node = unwrapExpression(rawNode);

  if (t.isStringLiteral(node)) {
    return node.value;
  }

  if (t.isNumericLiteral(node)) {
    return node.value;
  }

  if (t.isBooleanLiteral(node)) {
    return node.value;
  }

  if (t.isNullLiteral(node)) {
    return null;
  }

  if (t.isIdentifier(node) && node.name === 'undefined') {
    return undefined;
  }

  if (
    t.isUnaryExpression(node) &&
    node.operator === '-' &&
    t.isNumericLiteral(node.argument)
  ) {
    return -node.argument.value;
  }

  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw ?? '';
  }

  if (t.isJSXElement(node) || t.isJSXFragment(node)) {
    return generateCode(node);
  }

  if (t.isArrayExpression(node)) {
    return node.elements.map(element =>
      element ? evaluateLiteral(element) : null,
    );
  }

  if (t.isObjectExpression(node)) {
    const result: Record<string, unknown> = {};

    for (const prop of node.properties) {
      if (!t.isObjectProperty(prop)) {
        continue;
      }

      let key: string | null = null;

      if (t.isIdentifier(prop.key)) {
        key = prop.key.name;
      } else if (t.isStringLiteral(prop.key)) {
        key = prop.key.value;
      } else if (t.isNumericLiteral(prop.key)) {
        key = String(prop.key.value);
      }

      if (key === null) {
        continue;
      }

      result[key] = evaluateLiteral(prop.value);
    }

    return result;
  }

  return undefined;
};

export const parseValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  if (REGEX.NUMBER.test(trimmed)) {
    return parseFloat(trimmed);
  }

  if (REGEX.BOOLEAN_OR_NULL.test(trimmed)) {
    if (trimmed === 'true') {
      return true;
    }
    if (trimmed === 'false') {
      return false;
    }
    if (trimmed === 'null') {
      return null;
    }
    if (trimmed === 'undefined') {
      return undefined;
    }
  }

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      const ast = parseExpression(trimmed, {
        plugins: ['jsx', 'typescript'],
      });

      if (t.isObjectExpression(ast) || t.isArrayExpression(ast)) {
        return evaluateLiteral(ast);
      }
    } catch {
      /* Not an object or array literal: keep the string. */
    }

    return value;
  }

  return value;
};

export const extractNodeValue = (node: t.Node): ExtractedNodeValue => {
  if (t.isBooleanLiteral(node)) {
    return { type: 'boolean', value: node.value };
  }

  if (t.isNumericLiteral(node)) {
    return { type: 'number', value: node.value };
  }

  if (
    t.isUnaryExpression(node) &&
    node.operator === '-' &&
    t.isNumericLiteral(node.argument)
  ) {
    return { type: 'number', value: -node.argument.value };
  }

  if (t.isStringLiteral(node)) {
    return { type: 'string', value: node.value };
  }

  if (t.isTemplateLiteral(node)) {
    if (node.expressions.length === 0 && node.quasis.length === 1) {
      return {
        type: 'string',
        value: dedent(
          node.quasis[0]!.value.cooked ?? node.quasis[0]!.value.raw,
        ),
      };
    }
    return { type: 'string', value: generateCode(node) };
  }

  if (t.isNullLiteral(node)) {
    return { type: 'null', value: null };
  }

  if (t.isArrayExpression(node)) {
    return { type: 'array', value: generateCode(node) };
  }

  if (t.isObjectExpression(node)) {
    return { type: 'object', value: generateCode(node) };
  }

  if (t.isJSXElement(node) || t.isJSXFragment(node)) {
    return { type: 'string', value: generateCode(node) };
  }

  return { type: 'unknown', value: null };
};

export const parseArrayExpression = (value: string) => {
  try {
    const ast = unwrapExpression(
      parseExpression(value, {
        plugins: ['jsx', 'typescript'],
      }),
    );

    if (!t.isArrayExpression(ast)) {
      return null;
    }

    return ast;
  } catch (error) {
    console.error('❌ Array parsing error:', error);
    return null;
  }
};

export const extractObjectProperties = (
  element: t.ObjectExpression,
): Record<string, ExtractedNodeValue & { astNode: t.Node }> => {
  const properties: Record<string, ExtractedNodeValue & { astNode: t.Node }> =
    {};

  element.properties.forEach(prop => {
    if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
      const key = prop.key.name;

      // `children` and other JSX-valued properties (such as `label`) are
      // edited through `useDndItems`'s nested elements instead (#298).
      if (
        key === 'children' ||
        t.isJSXElement(prop.value) ||
        t.isJSXFragment(prop.value)
      ) {
        return;
      }

      const extracted = extractNodeValue(prop.value);

      properties[key] = {
        ...extracted,
        astNode: prop.value,
      };
    }
  });

  return properties;
};
