import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';

import { REGEX } from '../../enums';
import { generateCode } from './helpers';
import type { ExtractedNodeValue, NodeValueType } from './types';

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
      return new Function(`return (${trimmed})`)();
    } catch {
      try {
        const ast = parseExpression(trimmed, {
          plugins: ['jsx', 'typescript'],
        });

        if (t.isObjectExpression(ast)) {
          const result: Record<string, unknown> = {};

          for (const prop of ast.properties) {
            if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) {
              continue;
            }
            if (t.isJSXElement(prop.value) || t.isJSXFragment(prop.value)) {
              result[prop.key.name] = generateCode(prop.value);
              continue;
            }
            result[prop.key.name] = extractNodeValue(prop.value).value;
          }

          return result;
        }
      } catch {
        /* ignore */
      }

      return value;
    }
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

export const createNodeFromValue = (
  type: NodeValueType,
  value: unknown,
): t.Expression | null => {
  switch (type) {
    case 'boolean': {
      return t.booleanLiteral(value === true);
    }
    case 'number': {
      return t.numericLiteral(Number(value));
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

export const parseArrayExpression = (value: string) => {
  try {
    const ast = parseExpression(value, {
      plugins: ['jsx', 'typescript'],
    });

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

      if (key === 'children') {
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

export const arrayExpressionToCode = (
  elements: t.ObjectExpression[],
): string => {
  const nextAst = t.arrayExpression(elements);
  return generateCode(nextAst);
};
