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

// Lists the editable leaves of an object or array value, with their paths.
// It follows the value's own shape, so it works without a `render` map
// (#225), as for `style` or an `items` array of `{ key, children }`. Strings,
// numbers and booleans are leaves, whatever a string contains. Deeply nested
// values stop at a fixed depth, and anything deeper is left out.
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

    // `null`, `undefined`, functions and symbols have no editable form and
    // are left out.
  };

  walk(parsed, [], 0);

  return entries.length ? entries : null;
};

// Finds the node `flattenEditableValue` reported at `path`, walking the
// same literal structure `evaluateLiteral` reads. Returns null for anything
// it can't point at with certainty: a missing key or index, a step through
// something that isn't an object or array, or a spread that could replace
// the entry at runtime.
const findEditableLeaf = (
  root: t.Node,
  path: EditablePathSegment[],
): t.Node | null => {
  let node = unwrapExpression(root);

  for (const segment of path) {
    if (t.isArrayExpression(node)) {
      if (typeof segment !== 'number') {
        return null;
      }

      const elements = node.elements.slice(0, segment + 1);
      const element = node.elements[segment];

      if (!element || elements.some(item => t.isSpreadElement(item))) {
        return null;
      }

      node = unwrapExpression(element);
      continue;
    }

    if (t.isObjectExpression(node)) {
      const key = String(segment);
      const matches = (property: t.ObjectExpression['properties'][number]) =>
        t.isObjectProperty(property) &&
        !property.computed &&
        ((t.isIdentifier(property.key) && property.key.name === key) ||
          (t.isStringLiteral(property.key) && property.key.value === key) ||
          (t.isNumericLiteral(property.key) &&
            String(property.key.value) === key));
      // The last match is the one a duplicate key leaves in effect, and the
      // one `evaluateLiteral` reports.
      let index = node.properties.length - 1;

      while (index >= 0 && !matches(node.properties[index]!)) {
        index--;
      }

      const property = node.properties[index];

      if (
        !property ||
        !t.isObjectProperty(property) ||
        node.properties.slice(index + 1).some(item => t.isSpreadElement(item))
      ) {
        return null;
      }

      node = unwrapExpression(property.value);
      continue;
    }

    return null;
  }

  return node;
};

const isEditableLeaf = (node: t.Node): boolean =>
  t.isStringLiteral(node) ||
  t.isNumericLiteral(node) ||
  t.isBooleanLiteral(node) ||
  (t.isUnaryExpression(node) &&
    node.operator === '-' &&
    t.isNumericLiteral(node.argument)) ||
  (t.isTemplateLiteral(node) && node.expressions.length === 0) ||
  t.isJSXElement(node) ||
  t.isJSXFragment(node);

const quoteString = (text: string, quote: string): string => {
  if (quote === '`') {
    return `\`${text.replace(/[\\`]|\$\{/g, match => `\\${match}`)}\``;
  }

  const escaped = JSON.stringify(text).slice(1, -1);

  return quote === '"'
    ? `"${escaped}"`
    : `'${escaped.replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;
};

const isJSXSource = (text: string): boolean => {
  try {
    const expression = parseExpression(text, { plugins: ['jsx'] });

    return t.isJSXElement(expression) || t.isJSXFragment(expression);
  } catch {
    return false;
  }
};

// Source text for `next` in place of `leaf`, keeping the leaf's own form
// where it has one: a string keeps its quotes, and a JSX leaf, which
// `flattenEditableValue` reports as its source text, stays JSX when the
// edited text still is.
const leafSource = (
  value: string,
  leaf: t.Node,
  next: EditablePrimitive,
): string => {
  if (typeof next !== 'string') {
    return String(next);
  }

  if ((t.isJSXElement(leaf) || t.isJSXFragment(leaf)) && isJSXSource(next)) {
    return next.trim();
  }

  const quote =
    t.isStringLiteral(leaf) || t.isTemplateLiteral(leaf)
      ? value[leaf.start!]!
      : "'";

  return quoteString(next, quote);
};

// Replaces the leaf at `path` (as `flattenEditableValue` reports it) and
// returns `value` with only that leaf's source changed, so formatting,
// comments, JSX, functions and references stay (#427). The result is a
// string for `PanelBinding.onChange`. A path it can't find, or a `value`
// that doesn't parse, returns `value` unchanged. It never adds a key or
// grows an array.
export const setEditableValue = (
  value: string,
  path: EditablePathSegment[],
  next: EditablePrimitive,
): string => {
  if (!path.length) {
    return value;
  }

  let leaf: t.Node | null;

  try {
    leaf = findEditableLeaf(
      parseExpression(value, { plugins: ['jsx', 'typescript'] }),
      path,
    );
  } catch {
    return value;
  }

  if (
    !leaf ||
    !isEditableLeaf(leaf) ||
    leaf.start == null ||
    leaf.end == null
  ) {
    return value;
  }

  return `${value.slice(0, leaf.start)}${leafSource(value, leaf, next)}${value.slice(leaf.end)}`;
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

// Builds an expression for a JS value: the inverse of `evaluateLiteral`
// (#238). Each JS type maps to one kind of literal. Values with no literal
// form (`undefined`, functions, symbols) give `null`. Inside an object the
// property is left out; inside an array the item becomes `null`.
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

export const arrayExpressionToCode = (
  elements: t.ObjectExpression[],
): string => {
  const nextAst = t.arrayExpression(elements);
  return generateCode(nextAst);
};
