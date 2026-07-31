import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { z } from 'zod';

import { BINDING_PROP, DATA_ATTR } from '../../enums';
import {
  BINDING_TYPES,
  type BindingItem,
  type BindingOption,
  type BindingRenderMap,
  type DataAttrNode,
} from './types';
import { evaluateLiteral, parseArrayExpression } from './value';

const bindingTypeSchema = z.enum(BINDING_TYPES);

const bindingOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const bindingRenderLeafSchema = z.object({
  type: bindingTypeSchema,
  property: z.string().optional(),
});

const rawBindingItemSchema = z.object({
  label: z.string(),
  property: z.string().optional(),
  type: bindingTypeSchema.optional(),
  options: z.array(bindingOptionSchema).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
  required: z.boolean().optional(),
});

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
      const leaf = bindingRenderLeafSchema.safeParse(raw);

      if (leaf.success) {
        const render = sanitizeRenderMap(raw.render);
        map[key] = render ? { ...leaf.data, render } : leaf.data;
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

export const parseBinding = (bindingValue: string | null): BindingItem[] => {
  if (!bindingValue) {
    return [];
  }

  const ast = parseArrayExpression(bindingValue);

  if (!ast) {
    return [];
  }

  const raw = evaluateLiteral(ast);

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
      type: sanitizedType.success ? sanitizedType.data : undefined,
      options: sanitizedOptions?.length ? sanitizedOptions : undefined,
    });

    if (!parsed.success) {
      continue;
    }

    const { label, property, type, options, min, max, pattern, required } =
      parsed.data;

    if (property === undefined && type !== 'richtext') {
      continue;
    }

    const render = sanitizeRenderMap(rawItem.render);

    items.push({
      label,
      property: property ?? BINDING_PROP.INNER_HTML,
      ...(type !== undefined && { type }),
      ...(options?.length && { options }),
      ...(render && { render }),
      ...(min !== undefined && { min }),
      ...(max !== undefined && { max }),
      ...(pattern !== undefined && { pattern }),
      ...(required !== undefined && { required }),
    });
  }

  return items;
};

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
