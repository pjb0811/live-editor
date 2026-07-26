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

// AST 노드를 코드 실행(new Function/eval) 없이 순수 리터럴 구조만 재귀적으로
// 실제 JS 값으로 변환한다. 함수 호출, 변수 참조 등 리터럴이 아닌 표현식은
// 평가하지 않고 undefined를 반환한다 — 사용자 코드는 iframe 안에서만 실행한다는
// 이 저장소의 원칙(AGENTS.md)을 이 패널 UI(메인 문서에서 렌더링됨)에서도 지키기 위함.
const evaluateLiteral = (node: t.Node): unknown => {
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
      if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) {
        continue;
      }
      result[prop.key.name] = evaluateLiteral(prop.value);
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
      /* ignore */
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
