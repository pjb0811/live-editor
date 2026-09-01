import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';

import { REGEX } from '../../constants';
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

// Peel type-only wrappers and parentheses off an expression so the literal
// underneath can be read. Authored bindings may carry `satisfies BindingItem[]`
// (or `as const`, a type assertion, ...) for editor type-safety; those are
// erased at build time and mean nothing to this literal evaluator, so without
// unwrapping them the value — or the whole binding array — would be silently
// dropped as "not a literal".
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

// AST 노드를 코드 실행(new Function/eval) 없이 순수 리터럴 구조만 재귀적으로
// 실제 JS 값으로 변환한다. 함수 호출, 변수 참조 등 리터럴이 아닌 표현식은
// 평가하지 않고 undefined를 반환한다 — 사용자 코드는 iframe 안에서만 실행한다는
// 이 저장소의 원칙(AGENTS.md)을 이 패널 UI(메인 문서에서 렌더링됨)에서도 지키기 위함.
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
      /* ignore */
    }

    return value;
  }

  return value;
};

export type EditablePathSegment = string | number;
export type EditablePrimitive = string | number | boolean;

export interface EditableValueEntry {
  path: EditablePathSegment[];
  value: EditablePrimitive;
}

const MAX_FLATTEN_DEPTH = 20;

const isEditablePrimitive = (value: unknown): value is EditablePrimitive =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

// A binding's data-binding declaration is one way to know a value is
// structured (`type: 'object'` + a `render` map — see #225), but most
// existing content declares neither; it's just an object/array-shaped
// string because that's what the bound prop actually is (e.g. `style`).
// This recovers editable leaves from the *parsed value's own shape*
// instead, so it works on content authored without a renderPanel in mind
// — including an array of objects whose own members embed further JSX
// (Live Editor's shipped Stats/FAQ sections both look like this: an
// `items` array of `{ key, children }`, where `children` is itself a
// nested, separately data-bound element). A JSX-bearing string is never
// parsed further here — `parseValue` already reduced it to plain text
// (see `evaluateLiteral`'s JSXElement case), and this function only ever
// recurses into genuine object/array structure, treating every string,
// number, and boolean as a leaf regardless of what the string contains.
// Depth is capped defensively (pathological/deeply-recursive input
// shouldn't be able to blow the stack); anything past that depth is
// treated as a leaf-less dead end and simply omitted, not thrown.
export const flattenEditableValue = (
  value: string,
): EditableValueEntry[] | null => {
  const parsed = parseValue(value);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Object.keys(parsed).length === 0
  ) {
    return null;
  }

  const entries: EditableValueEntry[] = [];

  const walk = (node: unknown, path: EditablePathSegment[], depth: number) => {
    if (depth > MAX_FLATTEN_DEPTH) {
      return;
    }

    if (isEditablePrimitive(node)) {
      entries.push({ path, value: node });
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, [...path, index], depth + 1));
      return;
    }

    if (typeof node === 'object' && node !== null) {
      Object.entries(node).forEach(([key, item]) =>
        walk(item, [...path, key], depth + 1),
      );
    }

    // null/undefined/function/symbol values have no editable leaf form —
    // silently omitted rather than represented as, say, an empty string,
    // which would misrepresent what's actually stored there.
  };

  walk(parsed, [], 0);

  return entries.length ? entries : null;
};

// Companion to `flattenEditableValue`: replaces the single leaf at `path`
// and re-serializes the whole structure — the result is a plain string
// suitable for `PanelBinding.onChange`/`Dnd`'s AST-update pipeline, same
// as any other committed value. Fails safe: an out-of-range index, a
// missing key, or a `value` that didn't parse to an object/array in the
// first place returns `value` unchanged rather than throwing or silently
// writing to the wrong place.
export const setEditableValue = (
  value: string,
  path: EditablePathSegment[],
  next: EditablePrimitive,
): string => {
  if (!path.length) {
    return value;
  }

  const parsed = parseValue(value);

  if (typeof parsed !== 'object' || parsed === null) {
    return value;
  }

  const root: unknown = Array.isArray(parsed) ? [...parsed] : { ...parsed };
  let cursor: Record<EditablePathSegment, unknown> | unknown[] = root as
    Record<EditablePathSegment, unknown> | unknown[];

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    const child = (cursor as Record<EditablePathSegment, unknown>)[key];

    if (typeof child !== 'object' || child === null) {
      return value;
    }

    const clonedChild = Array.isArray(child) ? [...child] : { ...child };
    (cursor as Record<EditablePathSegment, unknown>)[key] = clonedChild;
    cursor = clonedChild as Record<EditablePathSegment, unknown> | unknown[];
  }

  const lastKey = path[path.length - 1]!;

  if (!(lastKey in (cursor as object))) {
    return value;
  }

  (cursor as Record<EditablePathSegment, unknown>)[lastKey] = next;

  return JSON.stringify(root);
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

// Faithfully rebuilds a JS value into an AST expression node — the inverse
// of `evaluateLiteral`, and the single serialization point #238 moves the
// panel's value contract onto. Because the caller already knows what the
// value *is* (a real number/boolean/object/array, not a string that has to
// be re-guessed), there is no string-vs-expression heuristic here: each JS
// type maps to exactly one literal kind. Values with no literal form
// (`undefined`, functions, symbols) are dropped — an object property whose
// value is `undefined` is omitted rather than emitted as `undefined`,
// mirroring `flattenEditableValue`, which also treats them as absent.
export const valueToExpression = (value: unknown): t.Expression | null => {
  if (typeof value === 'string') {
    return t.stringLiteral(value);
  }

  if (typeof value === 'number') {
    return value < 0
      ? t.unaryExpression('-', t.numericLiteral(-value))
      : t.numericLiteral(value);
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
