import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { nanoid } from 'nanoid';

import { BINDING_PROP } from '../../constants';
import { moveSelectedIndices, removeIndices } from '../selection';
import { generateCode } from './helpers';
import { clone } from './tree';
import type {
  BindingRenderLeaf,
  BindingRenderMap,
  NodeValueType,
} from './types';
import {
  createNodeFromValue,
  extractNodeValue,
  extractObjectProperties,
  parseArrayExpression,
  parseValue,
  valueToExpression,
} from './value';

// The editing engine behind the built-in array-item panel. Every function
// here is string in, string out: the array source is re-parsed on each call
// and the resulting tree is thrown away, so nothing is shared with a
// caller's memoized state and there is no live AST to keep in sync.
//
// This used to live in `panel/items.tsx`, where it mutated the nodes held
// by a `useMemo` and restored JSX by substituting `__JSX_<id>__` strings
// into the generated output. Neither is needed: Babel prints JSX inside an
// object literal correctly, and a raw JSX value parses straight into a
// node. See #247.
//
// `null` means the edit could not be applied and the caller should keep the
// value it already has.

export type ItemKind = 'object' | 'primitive';

export interface ArrayItem {
  // Position in the array's elements, which is what every function here
  // indexes by. Items of one kind are not renumbered, so a mixed array
  // stays addressable.
  index: number;
  kind: ItemKind;
  node: t.Expression;
}

const elementsOf = (code: string): t.Expression[] | null => {
  const ast = parseArrayExpression(code);

  if (!ast) {
    return null;
  }

  return ast.elements.filter((element): element is t.Expression =>
    Boolean(element),
  );
};

const kindOf = (element: t.Expression): ItemKind =>
  t.isObjectExpression(element) ? 'object' : 'primitive';

const toCode = (elements: t.Expression[]): string => {
  return generateCode(t.arrayExpression(elements));
};

// Reads the array's elements without touching them. The caller renders from
// this; every edit goes back through the source string, never through these
// nodes.
export const parseItems = (code: string): ArrayItem[] | null => {
  const elements = elementsOf(code);

  if (!elements) {
    return null;
  }

  return elements.map((node, index) => ({
    index,
    kind: kindOf(node),
    node,
  }));
};

const resolveRenderLeaf = (
  render: BindingRenderMap | undefined,
  key: string,
): BindingRenderLeaf | null => {
  const leaf = render?.[key];

  return leaf && 'type' in leaf ? (leaf as BindingRenderLeaf) : null;
};

// Whether a node's value survives `evaluateLiteral` intact. It returns
// `undefined` for anything that isn't a literal and skips spread properties
// outright, so rebuilding from its output would quietly drop an identifier,
// a call, or a spread — `{ c: theme.red }` would be written back as `{}`.
// Rebuilding is only safe when the node holds nothing but literals.
//
// The accepted set mirrors the branches `evaluateLiteral` and
// `valueToExpression` both handle, so a shape that round-trips faithfully
// isn't refused: a negative number is a `UnaryExpression`, not a literal
// node, and an expression-free template literal is just a string.
const isLosslesslyEvaluable = (node: t.Node): boolean => {
  if (
    t.isStringLiteral(node) ||
    t.isNumericLiteral(node) ||
    t.isBooleanLiteral(node) ||
    t.isNullLiteral(node)
  ) {
    return true;
  }

  if (
    t.isUnaryExpression(node) &&
    node.operator === '-' &&
    t.isNumericLiteral(node.argument)
  ) {
    return true;
  }

  if (t.isTemplateLiteral(node)) {
    return node.expressions.length === 0;
  }

  if (t.isArrayExpression(node)) {
    return node.elements.every(
      element => element !== null && isLosslesslyEvaluable(element),
    );
  }

  if (t.isObjectExpression(node)) {
    return node.properties.every(
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

// Escapes text for a template literal's raw slot. `@babel/types` rejects a
// raw containing an unescaped backtick or `${`, a lone backslash would
// otherwise be read back as an escape sequence, and a carriage return is
// normalized to a newline by the spec's raw-value rules — so raw markup
// pasted into an innerHTML field used to throw straight out of the edit
// handler, and CRLF would not survive a round trip.
const toTemplateRaw = (value: string): string => {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .replace(/\r/g, '\\r');
};

// Builds the node a property should hold, from the value the panel produced.
// Returns `undefined` when the value can't be represented, which callers
// treat as "leave the source alone".
const buildPropertyValue = (
  value: unknown,
  declaredType: NodeValueType,
  renderLeaf: BindingRenderLeaf | null,
  current: t.Expression,
): t.Expression | undefined => {
  // innerHTML carries raw markup, which has to survive as written — a
  // template literal keeps it verbatim without escaping.
  if (renderLeaf?.property === BINDING_PROP.INNER_HTML) {
    const raw = String(value);

    return t.templateLiteral(
      [t.templateElement({ raw: toTemplateRaw(raw), cooked: raw }, true)],
      [],
    );
  }

  if (renderLeaf?.type === 'jsx') {
    const trimmed = String(value).trim();

    // Anything that isn't markup is a plain string for this property.
    if (!trimmed.startsWith('<')) {
      return t.stringLiteral(trimmed);
    }

    try {
      return parseExpression(trimmed, { plugins: ['jsx', 'typescript'] });
    } catch {
      return undefined;
    }
  }

  if (declaredType === 'array' || declaredType === 'object') {
    // The nested Items editor commits serialized source text, while the
    // object editor and the fallback TextArea commit a real JS value.
    // Parsing the former directly avoids evaluating it and `String()`-ing
    // it back to `1,2` (a sequence expression).
    if (typeof value === 'string') {
      try {
        return parseExpression(value, { plugins: ['jsx', 'typescript'] });
      } catch {
        return undefined;
      }
    }

    // The latter has already been through `evaluateLiteral`, so it can only
    // be rebuilt faithfully when the property held nothing but literals to
    // begin with. Otherwise the edit is refused and the source is left
    // alone, which is the safe half of what this path used to do.
    if (!isLosslesslyEvaluable(current)) {
      return undefined;
    }

    return valueToExpression(value) ?? undefined;
  }

  // Scalars arrive as the text typed into the field, so coerce before
  // building the literal — `createNodeFromValue('boolean', 'true')` would
  // otherwise compare the string against `true` and yield `false`.
  return createNodeFromValue(declaredType, parseValue(value)) ?? undefined;
};

export const updateArrayItemProperty = (
  code: string,
  index: number,
  key: string,
  value: unknown,
  render?: BindingRenderMap,
): string | null => {
  const elements = elementsOf(code);
  const element = elements?.[index];

  if (!elements || !t.isObjectExpression(element)) {
    return null;
  }

  const target = element.properties.find(
    (property): property is t.ObjectProperty =>
      t.isObjectProperty(property) &&
      t.isIdentifier(property.key) &&
      property.key.name === key,
  );

  if (!target) {
    return null;
  }

  const declaredType = extractObjectProperties(element)[key]?.type ?? 'string';
  const nextValue = buildPropertyValue(
    value,
    declaredType,
    resolveRenderLeaf(render, key),
    target.value as t.Expression,
  );

  if (!nextValue) {
    return null;
  }

  target.value = nextValue;

  return toCode(elements);
};

export const updateArrayItemValue = (
  code: string,
  index: number,
  value: unknown,
): string | null => {
  const elements = elementsOf(code);
  const element = elements?.[index];

  if (!elements || !element) {
    return null;
  }

  const nextValue = createNodeFromValue(
    extractNodeValue(element).type,
    parseValue(value),
  );

  if (!nextValue) {
    return null;
  }

  elements[index] = nextValue;

  return toCode(elements);
};

export const moveArrayItem = (
  code: string,
  from: number,
  to: number,
): string | null => {
  const elements = elementsOf(code);

  if (!elements?.[from]) {
    return null;
  }

  // `to` is left unchecked so the splice pair keeps its usual semantics: a
  // destination past the end appends, and a single-item move that goes
  // nowhere is a no-op rather than a reported failure.
  const next = [...elements];
  const [moved] = next.splice(from, 1);

  next.splice(to, 0, moved!);

  return toCode(next);
};

// Shifts the selection as a block and reports where it ended up, so the
// caller can keep its selection state in step without redoing the maths.
export const moveArrayItems = (
  code: string,
  indices: Set<number>,
  direction: 'up' | 'down',
): { code: string; indices: Set<number> } | null => {
  const elements = elementsOf(code);

  if (!elements) {
    return null;
  }

  const { items, indices: nextIndices } = moveSelectedIndices(
    elements,
    indices,
    direction,
  );

  return { code: toCode(items), indices: nextIndices };
};

// Refuses to remove the last item of its kind: the panel shows one kind at
// a time and every "add" clones an existing item of that kind, so emptying
// it leaves no way back. Counting the whole array instead would let the
// object panel delete its last object while a primitive kept the total
// above zero.
export const removeArrayItems = (
  code: string,
  indices: Set<number>,
  kind?: ItemKind,
): string | null => {
  const elements = elementsOf(code);

  if (!elements) {
    return null;
  }

  const remaining = removeIndices(elements, indices);
  const survivors =
    kind === undefined
      ? remaining
      : remaining.filter(element => kindOf(element) === kind);

  if (survivors.length < 1) {
    return null;
  }

  return toCode(remaining);
};

// Gives a cloned item a fresh `key`, so React can still tell the copy from
// its original, and normalizes its editable properties back to literals.
const cloneItem = (
  element: t.Expression,
  generateId: () => string,
): t.Expression => {
  const cloned = clone(element) as t.Expression;

  if (!t.isObjectExpression(cloned)) {
    return cloned;
  }

  const editable = extractObjectProperties(cloned);

  cloned.properties.forEach(property => {
    if (!t.isObjectProperty(property) || !t.isIdentifier(property.key)) {
      return;
    }

    const key = property.key.name;

    if (key === 'key' && t.isStringLiteral(property.value)) {
      property.value = t.stringLiteral(
        `${property.value.value}-${generateId()}`,
      );
      return;
    }

    const source = editable[key];

    if (source) {
      const next = createNodeFromValue(source.type, source.value);

      if (next) {
        property.value = next;
      }
    }
  });

  return cloned;
};

export const duplicateArrayItems = (
  code: string,
  indices: Set<number>,
  generateId: () => string = () => nanoid(6),
): string | null => {
  const elements = elementsOf(code);

  if (!elements) {
    return null;
  }

  const clones = [...indices]
    .sort((a, b) => a - b)
    .map(index => elements[index])
    .filter((element): element is t.Expression => Boolean(element))
    .map(element => cloneItem(element, generateId));

  if (clones.length === 0) {
    return null;
  }

  return toCode([...elements, ...clones]);
};

// Appends a copy of the first item of `kind`. There is no schema to build a
// blank item from, so an existing one is the only available template.
export const appendArrayItem = (
  code: string,
  kind: ItemKind,
  generateId: () => string = () => nanoid(6),
): string | null => {
  const elements = elementsOf(code);

  if (!elements) {
    return null;
  }

  const template = elements.find(element => kindOf(element) === kind);

  if (!template) {
    return null;
  }

  if (kind === 'primitive') {
    const { type, value } = extractNodeValue(template);
    const next = createNodeFromValue(type, value);

    return next ? toCode([...elements, next]) : null;
  }

  return toCode([...elements, cloneItem(template, generateId)]);
};
