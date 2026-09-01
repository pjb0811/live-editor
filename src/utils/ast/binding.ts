import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { z } from 'zod';

import { BINDING_PROP, DATA_ATTR } from '../../constants';
import {
  BINDING_TYPES,
  type BindingItem,
  type BindingOption,
  type BindingRenderMap,
  type BindingType,
  type DataAttrNode,
} from './types';
import { evaluateLiteral, parseArrayExpression, parseValue } from './value';

const bindingTypeSchema = z.enum(BINDING_TYPES);

const bindingOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

// `type` is validated separately in sanitizeRenderMap (like the top-level
// item's own type) so an unrecognized value degrades the leaf to untyped
// instead of failing this whole schema — see #234.
const bindingRenderLeafSchema = z.object({
  property: z.string().optional(),
});

// `widget` is deliberately just `z.string()`, not an enum — see #236. An
// unrecognized widget is expected (a renderPanel consumer's own value, not
// this library's), so unlike `type` there is no "drop it" failure mode to
// design for.
//
// `.passthrough()` (rather than the default `.strip()`) keeps any key this
// schema doesn't know about instead of silently discarding it — see #234.
// A consumer's own metadata (`step`, `unit`, a widget hint, ...) survives
// parsing and is surfaced separately as `meta` below, namespaced instead of
// spread onto the item, so it can't collide with a future first-class field.
const rawBindingItemSchema = z
  .object({
    label: z.string(),
    property: z.string().optional(),
    type: bindingTypeSchema.optional(),
    widget: z.string().optional(),
    options: z.array(bindingOptionSchema).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    required: z.boolean().optional(),
  })
  .passthrough();

// Every key `rawBindingItemSchema` declares, plus `render` (handled by
// `sanitizeRenderMap` separately, never through this schema) — anything
// else surviving `.passthrough()` is consumer-defined and belongs in `meta`,
// not treated as one of this library's own fields.
const KNOWN_BINDING_KEYS = new Set([
  'label',
  'property',
  'type',
  'widget',
  'options',
  'render',
  'min',
  'max',
  'pattern',
  'required',
]);

// The two BINDING_TYPES entries that describe a control, not a data kind —
// see the type/widget split in #236. Normalized below into `widget` instead
// of being passed through as `type` directly.
const WIDGET_TYPE_ALIASES = new Set(['icon-picker', 'asset-picker']);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

// A render map entry is either a "leaf" (has its own `type`) or a nested
// map of further entries — recurse into whichever it looks like, and drop
// anything that matches neither instead of failing the whole map.
const sanitizeRenderMap = (value: unknown): BindingRenderMap | undefined => {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const map: BindingRenderMap = {};

  for (const [key, raw] of Object.entries(value)) {
    if (!isPlainObject(raw)) {
      continue;
    }

    if ('type' in raw) {
      // Drop an unrecognized `type` down to untyped instead of dropping the
      // whole entry — matches the top-level item's own behavior at
      // `bindingTypeSchema.safeParse(rawItem.type)` above. Keeping the
      // entry (rather than deleting the key) is what #234 asked for: a
      // typo'd/future leaf type still shows up as a plain field instead of
      // vanishing, and `'type' in leaf` stays true either way since `type`
      // is always set below, even to `undefined`.
      const sanitizedType = bindingTypeSchema.safeParse(raw.type);
      const leaf = bindingRenderLeafSchema.safeParse(raw);

      if (leaf.success) {
        const render = sanitizeRenderMap(raw.render);
        const typedLeaf = {
          ...leaf.data,
          type: sanitizedType.success ? sanitizedType.data : undefined,
        };

        map[key] = render ? { ...typedLeaf, render } : typedLeaf;
      }
      continue;
    }

    const nested = sanitizeRenderMap(raw);

    if (nested) {
      map[key] = nested;
    }
  }

  return Object.keys(map).length > 0 ? map : undefined;
};

// Shared tail of `parseBinding`/`parseBindingExpression`: turn the raw,
// already-evaluated array literal into validated `BindingItem[]`. The two
// callers differ only in how they reach this array — from a source string
// (public API) or straight off an expression AST (extract's hot path).
const buildBindingItems = (raw: unknown): BindingItem[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const items: BindingItem[] = [];

  for (const rawItem of raw) {
    if (!isPlainObject(rawItem)) {
      continue;
    }

    // Drop an unrecognized `type` instead of rejecting the whole item — an
    // authored binding with a typo'd/future type string still works as an
    // untyped field rather than disappearing entirely.
    const sanitizedType = bindingTypeSchema.safeParse(rawItem.type);

    // `icon-picker`/`asset-picker` describe a widget, not a data kind
    // (#236) — normalize them into `widget` instead of passing them
    // through as `type`. An explicitly authored `widget` (checked below,
    // once the schema has validated it) wins if both are somehow present.
    const isWidgetAlias =
      sanitizedType.success && WIDGET_TYPE_ALIASES.has(sanitizedType.data);
    const normalizedType = isWidgetAlias
      ? 'string'
      : sanitizedType.success
        ? sanitizedType.data
        : undefined;
    const derivedWidget = isWidgetAlias ? sanitizedType.data : undefined;

    // Drop individually malformed options instead of rejecting the whole
    // item — a select field with 3 valid options and 1 malformed one should
    // still work with the 3 valid ones.
    const sanitizedOptions = Array.isArray(rawItem.options)
      ? rawItem.options
          .map(option => {
            const parsed = bindingOptionSchema.safeParse(option);
            return parsed.success ? parsed.data : null;
          })
          .filter((option): option is BindingOption => option !== null)
      : undefined;

    const parsed = rawBindingItemSchema.safeParse({
      ...rawItem,
      type: normalizedType,
      options: sanitizedOptions?.length ? sanitizedOptions : undefined,
    });

    if (!parsed.success) {
      continue;
    }

    const {
      label,
      property,
      type,
      widget: explicitWidget,
      options,
      min,
      max,
      pattern,
      required,
    } = parsed.data;
    const widget = explicitWidget ?? derivedWidget;

    if (property === undefined && type !== 'richtext') {
      continue;
    }

    const render = sanitizeRenderMap(rawItem.render);

    const metaEntries = Object.entries(parsed.data).filter(
      ([key]) => !KNOWN_BINDING_KEYS.has(key),
    );
    const meta =
      metaEntries.length > 0 ? Object.fromEntries(metaEntries) : undefined;

    items.push({
      label,
      property: property ?? BINDING_PROP.INNER_HTML,
      ...(type !== undefined && { type }),
      ...(widget !== undefined && { widget }),
      ...(options?.length && { options }),
      ...(render && { render }),
      ...(min !== undefined && { min }),
      ...(max !== undefined && { max }),
      ...(pattern !== undefined && { pattern }),
      ...(required !== undefined && { required }),
      ...(meta && { meta }),
    });
  }

  return items;
};

export const parseBinding = (bindingValue: string | null): BindingItem[] => {
  if (!bindingValue) {
    return [];
  }

  const ast = parseArrayExpression(bindingValue);

  if (!ast) {
    return [];
  }

  return buildBindingItems(evaluateLiteral(ast));
};

// Same result as `parseBinding`, but fed the array-literal expression the
// parser already produced instead of a source string. `extract` authors
// `data-binding` as a real JSX object-array expression, so re-serializing it
// to a string only to `parseExpression` it straight back was a wasted Babel
// round-trip (#241's "two parsers"); evaluate that AST in place.
export const parseBindingExpression = (
  expression: t.ArrayExpression,
): BindingItem[] => buildBindingItems(evaluateLiteral(expression));

export const getCurrentValue = (
  node: DataAttrNode,
  property: string,
): string => {
  switch (property) {
    case BINDING_PROP.INNER_TEXT: {
      return node.textContent || '';
    }

    case BINDING_PROP.INNER_HTML: {
      // richtext 타입: dangerouslySetInnerHTML={{ __html }} 에서 읽기
      const dsiAttr = node.attributes.find(
        a => a.name === 'dangerouslySetInnerHTML',
      );
      if (dsiAttr?.value) {
        try {
          const expr = parseExpression(dsiAttr.value, {
            plugins: ['jsx', 'typescript'],
          });
          if (t.isObjectExpression(expr)) {
            const htmlProp = expr.properties.find(
              p =>
                t.isObjectProperty(p) &&
                t.isIdentifier(p.key) &&
                p.key.name === '__html',
            ) as t.ObjectProperty | undefined;
            if (htmlProp) {
              if (t.isStringLiteral(htmlProp.value)) {
                return htmlProp.value.value;
              }
              if (
                t.isTemplateLiteral(htmlProp.value) &&
                htmlProp.value.expressions.length === 0
              ) {
                return (
                  htmlProp.value.quasis[0]?.value.cooked ??
                  htmlProp.value.quasis[0]?.value.raw ??
                  ''
                );
              }
            }
          }
        } catch {
          // ignore
        }
      }
      return node.rawChildren || node.textContent || '';
    }

    case BINDING_PROP.CHILDREN: {
      return JSON.stringify(node?.children || []);
    }

    default: {
      const customAttr = node.attributes.find(attr => attr.name === property);
      const value = customAttr?.value || '';

      return value;
    }
  }
};

// Declared types whose value is genuinely text — never re-parsed into a
// number/object/array even when the text happens to look like one. `jsx`
// and `richtext` carry source that is an expression, not a literal, so they
// stay as their exact source string too (the update pipeline re-inserts
// them as expressions, not string literals).
const STRING_VALUED_TYPES: ReadonlySet<BindingType> = new Set([
  'string',
  'url',
  'date',
  'color',
  'jsx',
  'richtext',
  'icon-picker',
  'asset-picker',
]);

// Structured counterpart to `getCurrentValue`: returns the value as its real
// JS type (number/boolean/object/array/string) rather than always as a
// string, so both the built-in panel and a custom `renderPanel` receive
// `PanelBinding.value` already typed. `getCurrentValue` still supplies the
// exact source text (`PanelBinding.rawValue`). See #238.
//
// The string-vs-structure decision is made *here*, from information the AST
// still has — an attribute that was a string literal in source is a genuine
// string whatever its contents, so `"{not an expression}"` stays a string
// instead of being re-parsed into an object. Only genuine expressions
// (`count={3}`, `data={[...]}`) are recovered into their real shape.
export const getStructuredValue = (
  node: DataAttrNode,
  property: string,
  type?: BindingType,
): unknown => {
  switch (property) {
    case BINDING_PROP.INNER_TEXT:
    case BINDING_PROP.INNER_HTML: {
      return getCurrentValue(node, property);
    }

    case BINDING_PROP.CHILDREN: {
      return node.children ?? [];
    }

    default: {
      const raw = getCurrentValue(node, property);
      const attr = node.attributes.find(a => a.name === property);

      if (attr?.isStringLiteral || (type && STRING_VALUED_TYPES.has(type))) {
        return raw;
      }

      return parseValue(raw);
    }
  }
};

const hasEditableBindings = (node: DataAttrNode): boolean => {
  const bindingAttr = node.dataAttributes.find(
    attr => attr.name === DATA_ATTR.BINDING,
  );

  if (!bindingAttr?.value) {
    return false;
  }

  const bindings = node.bindings || parseBinding(bindingAttr.value);

  return bindings.length > 0;
};

export const findEditableChildren = (node: DataAttrNode): DataAttrNode[] => {
  const editableChildren: DataAttrNode[] = [];

  const traverse = (children: DataAttrNode[] | undefined) => {
    if (!children) {
      return;
    }

    for (const child of children) {
      if (hasEditableBindings(child)) {
        editableChildren.push(child);
      }
      traverse(child.children);
    }
  };

  traverse(node.children);

  return editableChildren;
};
