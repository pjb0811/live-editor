import * as t from '@babel/types';

import type { NodeValueType } from './types';

// Builds AST expressions and source text from JS values: the inverse of
// reading them in `value.ts`.

// A number literal, with a negative written as `-n`: Babel rejects a
// negative `numericLiteral`. `null` for `NaN` and `Infinity`, which have no
// literal form (#712).
const numberToExpression = (value: number): t.Expression | null => {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (value < 0 || Object.is(value, -0)) {
    return t.unaryExpression('-', t.numericLiteral(-value));
  }

  return t.numericLiteral(value);
};

export const createNodeFromValue = (
  type: NodeValueType,
  value: unknown,
): t.Expression | null => {
  switch (type) {
    case 'boolean': {
      return t.booleanLiteral(value === true);
    }
    case 'number': {
      return numberToExpression(Number(value));
    }
    case 'string': {
      return t.stringLiteral(String(value));
    }
    case 'null': {
      return t.nullLiteral();
    }
    case 'array':
    case 'object':
    case 'unknown': {
      return null;
    }
    default: {
      return null;
    }
  }
};

// Builds an expression for a JS value: the inverse of `evaluateLiteral`
// (#238). Each JS type maps to one kind of literal. Values with no literal
// form (`undefined`, functions, symbols) give `null`. Inside an object the
// property is left out; inside an array the item becomes `null`.
export const valueToExpression = (value: unknown): t.Expression | null => {
  if (typeof value === 'string') {
    return t.stringLiteral(value);
  }

  if (typeof value === 'number') {
    return numberToExpression(value);
  }

  if (typeof value === 'boolean') {
    return t.booleanLiteral(value);
  }

  if (value === null) {
    return t.nullLiteral();
  }

  if (Array.isArray(value)) {
    return t.arrayExpression(
      value.map(item => valueToExpression(item) ?? t.nullLiteral()),
    );
  }

  if (typeof value === 'object') {
    const properties: t.ObjectProperty[] = [];

    for (const [key, item] of Object.entries(value)) {
      const expr = valueToExpression(item);
      if (expr === null) {
        continue;
      }
      properties.push(t.objectProperty(t.stringLiteral(key), expr));
    }

    return t.objectExpression(properties);
  }

  return null;
};
