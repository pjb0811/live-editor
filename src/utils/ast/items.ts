import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { nanoid } from 'nanoid';

import { BINDING_PROP } from '../../constants';
import { moveSelectedIndices, removeIndices } from '../selection';
import {
  appendArraySource,
  denseArraySource,
  removeArraySource,
  reorderArraySource,
  validArrayIndices,
} from './array-source';
import { generateCode } from './helpers';
import { type SourceEdit, applyEdits } from './patch';
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

// Array edits are source patches. Parsing locates the requested value or
// element; unrelated expressions, comments and formatting are not printed
// again. Structural edits require dense arrays; value edits preserve holes
// and spreads at their existing source positions. `null` means refusal.

export type ItemKind = 'object' | 'primitive';

export interface ArrayItem {
  // Position in the array's elements, which is what every function here
  // indexes by. Items of one kind are not renumbered, so a mixed array
  // stays addressable.
  index: number;
  kind: ItemKind;
  node: t.Expression;
}

const elementsOf = (code: string) =>
  parseArrayExpression(code)?.elements ?? null;

const kindOf = (element: t.Expression): ItemKind =>
  t.isObjectExpression(element) ? 'object' : 'primitive';

// Omit holes and spreads from the visible list without renumbering source
// positions. A spread is not one runtime value that the panel can edit.
export const parseItems = (code: string): ArrayItem[] | null => {
  const elements = elementsOf(code);

  return (
    elements?.flatMap((node, index) =>
      t.isExpression(node) ? [{ index, kind: kindOf(node), node }] : [],
    ) ?? null
  );
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

  // A declared `render[key].type === 'jsx'` covers a schema-declared JSX
  // property; a property whose *current* value is already JSX (e.g. the
  // items panel's fallback editor for a JSX-valued property with no
  // extractable bindings, see #298) needs the same treatment even without
  // that declaration, so it round-trips as JSX rather than as a string.
  if (
    renderLeaf?.type === 'jsx' ||
    t.isJSXElement(current) ||
    t.isJSXFragment(current)
  ) {
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

  let serialized =
    typeof value === 'string' &&
    (declaredType === 'array' ||
      declaredType === 'object' ||
      t.isJSXElement(nextValue) ||
      t.isJSXFragment(nextValue))
      ? value.trim()
      : generateCode(nextValue);

  if (
    nextValue.trailingComments?.some(comment => comment.type === 'CommentLine')
  ) {
    serialized += '\n';
  }

  // A shorthand property shares the key/value span: expand it explicitly.
  const content = target.shorthand ? `${key}: ${serialized}` : serialized;

  return applyEdits(code, [
    { start: target.value.start!, end: target.value.end!, content },
  ]);
};

export const updateArrayItemValue = (
  code: string,
  index: number,
  value: unknown,
): string | null => {
  const elements = elementsOf(code);
  const element = elements?.[index];

  if (!elements || !t.isExpression(element)) {
    return null;
  }

  const nextValue = createNodeFromValue(
    extractNodeValue(element).type,
    parseValue(value),
  );

  if (!nextValue) {
    return null;
  }

  return applyEdits(code, [
    {
      start: element.start!,
      end: element.end!,
      content: generateCode(nextValue),
    },
  ]);
};

export const moveArrayItem = (
  code: string,
  from: number,
  to: number,
): string | null => {
  const data = denseArraySource(code);

  if (
    !data ||
    !validArrayIndices([from], data.elements.length) ||
    !Number.isInteger(to)
  ) {
    return null;
  }

  // Preserve the existing splice destination semantics (including append).
  const next = [...data.elements];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);

  return reorderArraySource(code, data.elements, next);
};

export const moveArrayItems = (
  code: string,
  indices: Set<number>,
  direction: 'up' | 'down',
): { code: string; indices: Set<number> } | null => {
  const data = denseArraySource(code);

  if (
    !data ||
    !validArrayIndices(indices, data.elements.length) ||
    !['up', 'down'].includes(direction)
  ) {
    return null;
  }

  const next = moveSelectedIndices(data.elements, indices, direction);

  return {
    code: reorderArraySource(code, data.elements, next.items),
    indices: next.indices,
  };
};

// Keep the last-item guard until the empty-array creation contract (#316)
// is implemented. It must count the visible kind in a mixed array.
export const removeArrayItems = (
  code: string,
  indices: Set<number>,
  kind?: ItemKind,
): string | null => {
  const data = denseArraySource(code);

  if (!data || !validArrayIndices(indices, data.elements.length)) {
    return null;
  }

  const remaining = removeIndices(data.elements, indices);
  const survivors =
    kind === undefined
      ? remaining
      : remaining.filter(node => kindOf(node) === kind);

  if (!survivors.length) {
    return null;
  }

  return removeArraySource(code, data, indices);
};

// Copy exact source; only static object keys / JSX identities get changed.
// Re-evaluating modeled property values here would erase expressions.
const copyItem = (
  code: string,
  element: t.Expression,
  generateId: () => string,
  usedIds: Set<string>,
): string | null => {
  const edits: SourceEdit[] = [];
  let unsupported = false;
  const reserveId = (id: string) => {
    if (usedIds.has(id)) {
      unsupported = true;
    }

    usedIds.add(id);

    return JSON.stringify(id);
  };

  t.traverseFast(element, node => {
    if (!t.isJSXOpeningElement(node)) {
      return;
    }

    const ids = node.attributes.filter(
      (attr): attr is t.JSXAttribute =>
        t.isJSXAttribute(attr) &&
        t.isJSXIdentifier(attr.name, { name: 'data-id' }),
    );
    const attr = ids[0];

    if (
      ids.length > 1 ||
      (attr &&
        (!t.isStringLiteral(attr.value) ||
          node.attributes
            .slice(node.attributes.indexOf(attr) + 1)
            .some(a => t.isJSXSpreadAttribute(a))))
    ) {
      unsupported = true;
      return;
    }

    if (attr && t.isStringLiteral(attr.value)) {
      edits.push({
        start: attr.value.start!,
        end: attr.value.end!,
        content: reserveId(generateId()),
      });
    }
  });

  if (t.isObjectExpression(element)) {
    const keys = element.properties.filter(
      (prop): prop is t.ObjectProperty =>
        t.isObjectProperty(prop) &&
        !prop.computed &&
        (t.isIdentifier(prop.key, { name: 'key' }) ||
          t.isStringLiteral(prop.key, { value: 'key' })),
    );
    const key = keys[0];

    if (
      keys.length > 1 ||
      (key &&
        (!t.isStringLiteral(key.value) ||
          element.properties
            .slice(element.properties.indexOf(key) + 1)
            .some(
              prop =>
                t.isSpreadElement(prop) ||
                ('computed' in prop && prop.computed),
            )))
    ) {
      return null;
    }

    if (key && t.isStringLiteral(key.value)) {
      edits.push({
        start: key.value.start!,
        end: key.value.end!,
        content: reserveId(`${key.value.value}-${generateId()}`),
      });
    }
  }

  if (unsupported) {
    return null;
  }

  return applyEdits(
    code.slice(element.start!, element.end!),
    edits.map(edit => ({
      ...edit,
      start: edit.start - element.start!,
      end: edit.end - element.start!,
    })),
  );
};

export const duplicateArrayItems = (
  code: string,
  indices: Set<number>,
  generateId: () => string = () => nanoid(6),
): string | null => {
  const data = denseArraySource(code);

  if (
    !data ||
    !indices.size ||
    !validArrayIndices(indices, data.elements.length)
  ) {
    return null;
  }

  const usedIds = new Set<string>();

  t.traverseFast(data.array, node => {
    if (
      t.isJSXAttribute(node) &&
      t.isJSXIdentifier(node.name, { name: 'data-id' }) &&
      t.isStringLiteral(node.value)
    ) {
      usedIds.add(node.value.value);
    } else if (
      t.isObjectProperty(node) &&
      !node.computed &&
      (t.isIdentifier(node.key, { name: 'key' }) ||
        t.isStringLiteral(node.key, { value: 'key' })) &&
      t.isStringLiteral(node.value)
    ) {
      usedIds.add(node.value.value);
    }
  });

  const copies = [...indices]
    .sort((a, b) => a - b)
    .map(index => copyItem(code, data.elements[index]!, generateId, usedIds));

  return copies.every((copy): copy is string => copy !== null)
    ? appendArraySource(code, data, copies)
    : null;
};

// Appends a copy of the first item of `kind`. There is deliberately no
// "create from scratch" path: the shape of an item is defined by its
// siblings, and inventing one (`{}`, or a guess from the render map) would
// either be uneditable or silently impose a shape the consumer never
// declared. An array binding is therefore editable only while it holds at
// least one item — the same invariant `removeArrayItems` maintains by
// refusing any edit that would empty the array. `null` here means the array
// has no item of `kind` to copy; the first one belongs in the source (#316).
export const appendArrayItem = (
  code: string,
  kind: ItemKind,
  generateId: () => string = () => nanoid(6),
): string | null => {
  const data = denseArraySource(code);
  const index = data?.elements.findIndex(node => kindOf(node) === kind) ?? -1;

  return index < 0
    ? null
    : duplicateArrayItems(code, new Set([index]), generateId);
};
