import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { z } from 'zod';

import { BINDING_PROP, DATA_ATTR } from '../../constants';
import {
  BINDING_TYPES,
  type BindingItem,
  type BindingOption,
  type BindingRenderLeaf,
  type BindingRenderMap,
  type BindingType,
  type BindingWidget,
  type DataAttrNode,
} from './types';
import { evaluateLiteral, parseArrayExpression, parseValue } from './value';

const bindingTypeSchema = z.enum(BINDING_TYPES);

const bindingOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

// `widget.type` is deliberately just `z.string()`, not an enum — see #236. The
// library implements no widgets, so every value is a custom panel author's
// own. `.passthrough()` keeps that panel's own control config
// (`{ type: 'slider', snapTo: [...] }`) instead of stripping it.
const bindingWidgetSchema = z
  .object({
    type: z.string().min(1),
    step: z.number().optional(),
    unit: z.string().optional(),
  })
  .passthrough();

// Parse one field on its own, degrading a malformed value to absent instead
// of failing the whole binding — a typo'd `min` or an unrecognized `type`
// costs that one axis, not the field. See #234.
const pick = <T>(schema: z.ZodType<T>, value: unknown): T | undefined => {
  const parsed = schema.safeParse(value);

  return parsed.success ? parsed.data : undefined;
};

// The bare-string form (`widget: 'slider'`) means the control with no extra
// config; normalizing it to `{ type }` leaves consumers one shape to switch on.
const sanitizeWidget = (value: unknown): BindingWidget | undefined => {
  if (typeof value === 'string') {
    return value ? { type: value } : undefined;
  }

  return pick(bindingWidgetSchema, value);
};

// Drop individually malformed options instead of rejecting them all — a
// select field with 3 valid options and 1 malformed one should still work
// with the 3 valid ones.
const sanitizeOptions = (value: unknown): BindingOption[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const options = value.flatMap(option => {
    const parsed = pick(bindingOptionSchema, option);

    return parsed ? [parsed] : [];
  });

  return options.length > 0 ? options : undefined;
};

// Every key this library reads off a binding — anything else authored on it
// is consumer-defined and belongs in `meta`, not treated as one of this
// library's own fields.
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

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

// The one sanitizer for what a binding declares about itself, shared by a
// top-level item and a render-map leaf so a field added later reaches both.
// Absent fields are left off rather than set to `undefined`.
const sanitizeField = (raw: Record<string, unknown>): BindingRenderLeaf => {
  const metaEntries = Object.entries(raw).filter(
    ([key]) => !KNOWN_BINDING_KEYS.has(key),
  );
  const field: BindingRenderLeaf = {
    label: pick(z.string(), raw.label),
    property: pick(z.string(), raw.property),
    type: pick(bindingTypeSchema, raw.type),
    widget: sanitizeWidget(raw.widget),
    options: sanitizeOptions(raw.options),
    render: sanitizeRenderMap(raw.render),
    min: pick(z.number(), raw.min),
    max: pick(z.number(), raw.max),
    pattern: pick(z.string(), raw.pattern),
    required: pick(z.boolean(), raw.required),
    meta: metaEntries.length > 0 ? Object.fromEntries(metaEntries) : undefined,
  };

  return Object.fromEntries(
    Object.entries(field).filter(([, value]) => value !== undefined),
  );
};

// A render map entry is either a "leaf" (has its own `type`) or a nested
// map of further entries — recurse into whichever it looks like, and drop
// anything that matches neither instead of failing the whole map.
function sanitizeRenderMap(value: unknown): BindingRenderMap | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const map: BindingRenderMap = {};

  for (const [key, raw] of Object.entries(value)) {
    if (!isPlainObject(raw)) {
      continue;
    }

    if ('type' in raw) {
      // `type` is always set, even to `undefined` when it didn't survive
      // sanitization, so `'type' in leaf` keeps identifying it as a leaf: a
      // typo'd/future leaf type still shows up as a plain field instead of
      // vanishing (#234).
      map[key] = { type: undefined, ...sanitizeField(raw) };
      continue;
    }

    const nested = sanitizeRenderMap(raw);

    if (nested) {
      map[key] = nested;
    }
  }

  return Object.keys(map).length > 0 ? map : undefined;
}

// Shared tail of `parseBinding`/`parseBindingExpression`: turn the raw,
// already-evaluated array literal into validated `BindingItem[]`. The two
// callers differ only in how they reach this array — from a source string
// (public API) or straight off an expression AST (extract's hot path).
const buildBindingItems = (raw: unknown): BindingItem[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap(rawItem => {
    if (!isPlainObject(rawItem)) {
      return [];
    }

    const { label, property, ...field } = sanitizeField(rawItem);

    if (label === undefined) {
      return [];
    }

    if (property === undefined && field.type !== 'richtext') {
      return [];
    }

    return [{ label, property: property ?? BINDING_PROP.INNER_HTML, ...field }];
  });
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
export const STRING_VALUED_TYPES: ReadonlySet<BindingType> = new Set([
  'string',
  'url',
  'date',
  'color',
  'jsx',
  'richtext',
]);

// Structured counterpart to `getCurrentValue`: returns the value as its real
// JS type (number/boolean/object/array/string) rather than always as a
// string, so both the built-in panel and a custom panel receive
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
