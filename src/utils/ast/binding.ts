import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { z } from 'zod';

import { BINDING_PROP, DATA_ATTR } from '../../constants';
import {
  BINDING_TYPES,
  type BindingItem,
  type BindingKeyMap,
  type BindingOption,
  type BindingOptions,
  type BindingRegistry,
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

// `widget.type` is any string, not an enum: the library implements no
// widgets, so every value belongs to a custom panel (#236). `.passthrough()`
// keeps that control's own config, such as `{ type: 'slider', snapTo: [...] }`.
const bindingWidgetSchema = z
  .object({
    type: z.string().min(1),
    step: z.number().optional(),
    unit: z.string().optional(),
  })
  .passthrough();

// Parses one key on its own. A malformed value becomes absent instead of
// failing the whole binding, so a typo in `min` loses only `min` (#234).
const pick = <T>(schema: z.ZodType<T>, value: unknown): T | undefined => {
  const parsed = schema.safeParse(value);

  return parsed.success ? parsed.data : undefined;
};

// Turns the string form (`widget: 'slider'`) into `{ type }`, so consumers
// see one shape.
const sanitizeWidget = (value: unknown): BindingWidget | undefined => {
  if (typeof value === 'string') {
    return value ? { type: value } : undefined;
  }

  return pick(bindingWidgetSchema, value);
};

// Drops only the malformed options and keeps the valid ones.
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

// Every key the library reads from a binding. Any other key is the app's
// own and goes into `meta`.
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

// Sanitizes the fields a binding declares. Shared by top-level bindings and
// render-map leaves, so a new field reaches both. Absent fields are left
// off, not set to `undefined`.
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

// A render map entry is a leaf (it has `type`) or a nested map. Anything
// else is dropped, without failing the whole map.
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
      // Keep the `type` key even when its value was dropped, so
      // `'type' in leaf` still marks it as a leaf: an unknown type shows as a
      // plain field instead of disappearing (#234).
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

// Validates an evaluated `data-binding` array into `BindingItem[]`. Used by
// `parseBinding` (from a string) and `parseBindingExpression` (from an AST).
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

// Registry entries are validated like an inline `data-binding`. Cached per
// registry object, which a host defines once rather than every render.
const registryEntries = new WeakMap<
  BindingRegistry,
  Map<string, BindingItem[]>
>();

// Whether a tag name is a component rather than an HTML element, by JSX's
// own rule: a member path, or an identifier that doesn't start with a
// lowercase letter. A namespaced name (`svg:rect`) resolves to `''` and is
// neither.
export const isComponentTagName = (tagName: string): boolean =>
  tagName !== '' && (tagName.includes('.') || !/^[a-z]/.test(tagName));

// The bindings `registry` gives an element of `tagName`, or `undefined` when
// it has no entry for that component. HTML elements never match, even when
// the registry has a key for them.
export const getRegistryBindings = (
  registry: BindingRegistry | undefined,
  tagName: string,
): BindingItem[] | undefined => {
  if (!registry) {
    return undefined;
  }

  let entries = registryEntries.get(registry);

  if (!entries) {
    entries = new Map();
    registryEntries.set(registry, entries);

    // Once per registry, so a key the type would have rejected doesn't go
    // unnoticed in plain JavaScript or behind a cast.
    const ignored = Object.keys(registry).filter(
      key => !isComponentTagName(key),
    );

    if (ignored.length > 0) {
      console.warn(
        `Live.Dnd \`bindings\` only applies to components. Ignored: ${ignored.join(', ')}. Bind an HTML element with its own data-binding.`,
      );
    }
  }

  if (!isComponentTagName(tagName) || !Object.hasOwn(registry, tagName)) {
    return undefined;
  }

  let bindings = entries.get(tagName);

  if (!bindings) {
    bindings = buildBindingItems(
      (registry as Record<string, BindingItem[] | undefined>)[tagName],
    );
    entries.set(tagName, bindings);
  }

  return bindings;
};

// Key map entries are validated like inline ones and cached per map, as
// registry entries are.
const keyEntries = new WeakMap<BindingKeyMap, Map<string, BindingItem[]>>();

// Each problem is reported once per key, not on every read of a section.
const warnedKeys = new Set<string>();

const warnOnce = (id: string, message: string) => {
  if (!warnedKeys.has(id)) {
    warnedKeys.add(id);
    console.warn(message);
  }
};

// The bindings `bindingKeys` has under `key`, or `undefined` when it has no
// such entry.
export const getKeyBindings = (
  bindingKeys: BindingKeyMap | undefined,
  key: string,
): BindingItem[] | undefined => {
  if (!bindingKeys || !Object.hasOwn(bindingKeys, key)) {
    return undefined;
  }

  let entries = keyEntries.get(bindingKeys);

  if (!entries) {
    entries = new Map();
    keyEntries.set(bindingKeys, entries);
  }

  let bindings = entries.get(key);

  if (!bindings) {
    bindings = buildBindingItems(bindingKeys[key]);
    entries.set(key, bindings);
  }

  return bindings;
};

// One element's bindings, from the most specific source it has (#513):
//
// 1. `own`, its `data-binding`, parsed. `undefined` when it has none; an
//    empty array is still its own, which is how an element opts out.
// 2. `key`, the string its `data-binding-key` names in `bindingKeys`.
//    `undefined` without the attribute, `null` when the attribute isn't a
//    plain string. A key with no entry gives no fields rather than falling
//    through to the registry.
// 3. Its component's entry in `bindings`.
export const resolveBindings = (
  own: BindingItem[] | undefined,
  key: string | null | undefined,
  tagName: string,
  options: BindingOptions = {},
): BindingItem[] => {
  if (own) {
    if (key !== undefined) {
      warnOnce(
        `both:${key}`,
        `Live.Dnd: an element has both data-binding and data-binding-key="${key ?? ''}". Its data-binding is used; remove one of them.`,
      );
    }

    return own;
  }

  if (key === null) {
    warnOnce(
      'not-a-string',
      'Live.Dnd: data-binding-key must be a plain string, such as data-binding-key="hero-title". The element has no fields.',
    );

    return [];
  }

  if (key !== undefined) {
    const bindings = getKeyBindings(options.bindingKeys, key);

    if (!bindings) {
      warnOnce(
        `missing:${key}`,
        `Live.Dnd: data-binding-key="${key}" isn't in bindingKeys. The element has no fields.`,
      );
    }

    return bindings ?? [];
  }

  return getRegistryBindings(options.bindings, tagName) ?? [];
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

// `parseBinding` for an array expression that is already parsed, as
// `extract` has it. Saves printing it and parsing it again (#241).
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
      // A `richtext` value lives in `dangerouslySetInnerHTML={{ __html }}`.
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
          // Not a readable object: fall back to the children below.
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

// Types whose value stays a string, even when the text looks like a number
// or an object. `jsx` and `richtext` hold source code, which `update` writes
// back as an expression.
export const STRING_VALUED_TYPES: ReadonlySet<BindingType> = new Set([
  'string',
  'url',
  'date',
  'color',
  'jsx',
  'richtext',
]);

// The value as its JS type (number, boolean, object, array or string), for
// `PanelBinding.value`. `getCurrentValue` gives the source text, for
// `PanelBinding.rawValue` (#238). A string literal in the source stays a
// string whatever it contains; only expressions such as `count={3}` or
// `data={[...]}` are read into their real shape.
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

// The node's bindings. `extract()` resolves them from all three sources
// (#509, #513); a node built some other way may only have its
// `data-binding` attribute, which is parsed here.
export const readNodeBindings = (node: DataAttrNode): BindingItem[] => {
  if (node.bindings) {
    return node.bindings;
  }

  const bindingAttr = node.dataAttributes.find(
    attr => attr.name === DATA_ATTR.BINDING,
  );

  return bindingAttr?.value ? parseBinding(bindingAttr.value) : [];
};

const hasEditableBindings = (node: DataAttrNode): boolean =>
  readNodeBindings(node).length > 0;

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
