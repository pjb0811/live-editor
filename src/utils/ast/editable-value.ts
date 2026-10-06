import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';

import { parseValue, unwrapExpression } from './value';

// The editable leaves of an object or array value: listing them with their
// paths, and replacing one while keeping the rest of the source as written.

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
