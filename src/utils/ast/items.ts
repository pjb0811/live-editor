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
  extractNodeValue,
  extractObjectProperties,
  isLosslesslyEvaluable,
  parseArrayExpression,
  parseValue,
} from './value';
import { createNodeFromValue, valueToExpression } from './value-expression';

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

// Escapes text for a template literal's raw source: backticks, `${`,
// backslashes and carriage returns. Without this, pasted markup can throw
// in `@babel/types`, and CRLF doesn't survive a round trip.
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
  // innerHTML is raw markup: a template literal keeps it as written.
  if (renderLeaf?.property === BINDING_PROP.INNER_HTML) {
    const raw = String(value);

    return t.templateLiteral(
      [t.templateElement({ raw: toTemplateRaw(raw), cooked: raw }, true)],
      [],
    );
  }

  // JSX when the render map declares `jsx`, or when the current value is
  // already JSX without a declaration, so it stays JSX (#298).
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
    // The nested Items editor commits source text; parse it as is. The
    // object editor and the fallback text area commit a JS value instead.
    if (typeof value === 'string') {
      try {
        return parseExpression(value, { plugins: ['jsx', 'typescript'] });
      } catch {
        return undefined;
      }
    }

    // A JS value can be rebuilt exactly only when the property held nothing
    // but literals. Otherwise the edit is refused and the source stays.
    if (!isLosslesslyEvaluable(current)) {
      return undefined;
    }

    return valueToExpression(value) ?? undefined;
  }

  // Scalars arrive as typed text, so convert first: the string `'true'`
  // would otherwise become `false` for a boolean.
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

// Appends a copy of the first item of `kind`. Items are never created from
// scratch, because their shape comes from their siblings. So an array
// needs at least one item to be editable, and `removeArrayItems` never
// empties it. `null` means there is no item of `kind` to copy; the first
// one has to be written in the source (#316).
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
