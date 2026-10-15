import * as t from '@babel/types';
import { nanoid } from 'nanoid';

import { findEditableChildren } from '~/utils/ast/binding';
import { extract } from '~/utils/ast/extract';
import { type BindingOptions, type DataAttrNode } from '~/utils/ast/types';
import {
  extractNodeValue,
  extractObjectProperties,
  parseArrayExpression,
} from '~/utils/ast/value';

// One item of the array source as parsed, before the panel bindings are
// built on it. `id` is a fresh id for this parse; `useDndItems` keeps the
// stable one in its identity state.
export interface RawObjectItem {
  id: string;
  index: number;
  elementIndex: number;
  source: string;
  editableProperties: ReturnType<typeof extractObjectProperties>;
  jsxBindings: Record<string, DataAttrNode[]>;
  jsxFallbacks: Record<string, string>;
}

export interface RawPrimitiveItem {
  id: string;
  index: number;
  elementIndex: number;
  source: string;
  value: string | number | boolean | null;
  type: ReturnType<typeof extractNodeValue>['type'];
}

// Pulls the data-bound elements out of one JSX-valued property. A container
// declaring `children` wins outright: it owns the elements below it, so
// listing them separately would offer the same edit twice.
const bindingsInJSX = (
  source: string,
  bindingOptions: BindingOptions | undefined,
): DataAttrNode[] => {
  const nodes = extract(source, bindingOptions);
  const container = nodes.find(n =>
    n.bindings?.some(b => b.property === 'children'),
  );

  if (container) {
    return [container];
  }

  const bindings: DataAttrNode[] = [];

  nodes.forEach(n => {
    if (
      n.bindings &&
      n.bindings.length > 0 &&
      n.dataAttributes.some(a => a.name === 'data-id')
    ) {
      bindings.push(n);
    }

    bindings.push(...findEditableChildren(n));
  });

  return bindings;
};

// Splits the array source into its object and primitive items, with
// `parseError` set when it isn't an array expression. Kept apart from
// building the bindings, so `useDndItems` memoizes the parse on the source
// while the callbacks stay current every render.
export const parseSource = (value: string, bindingOptions?: BindingOptions) => {
  const ast = parseArrayExpression(value);

  if (!ast) {
    return { objectItems: [], primitiveItems: [], parseError: true };
  }

  const objectItems: RawObjectItem[] = [];
  const primitiveItems: RawPrimitiveItem[] = [];
  ast.elements.forEach((element, elementIndex) => {
    if (!t.isExpression(element)) {
      return;
    }

    if (!t.isObjectExpression(element)) {
      const extracted = extractNodeValue(element);

      primitiveItems.push({
        id: nanoid(6),
        index: primitiveItems.length,
        elementIndex,
        source: value.slice(element.start!, element.end!),
        value: extracted.value,
        type: extracted.type,
      });
      return;
    }

    const jsxBindings: Record<string, DataAttrNode[]> = {};
    const jsxFallbacks: Record<string, string> = {};

    element.properties.forEach(prop => {
      if (
        !t.isObjectProperty(prop) ||
        !t.isIdentifier(prop.key) ||
        !(t.isJSXElement(prop.value) || t.isJSXFragment(prop.value))
      ) {
        return;
      }

      const propertyName = prop.key.name;

      try {
        const found = bindingsInJSX(
          value.slice(prop.value.start!, prop.value.end!),
          bindingOptions,
        );

        if (found.length > 0) {
          jsxBindings[propertyName] = found;
        } else {
          jsxFallbacks[propertyName] = value.slice(
            prop.value.start!,
            prop.value.end!,
          );
        }
      } catch (error) {
        console.error(
          `Failed to parse JSX in property '${propertyName}':`,
          error,
        );
      }
    });

    const editableProperties = extractObjectProperties(element);

    for (const property of Object.values(editableProperties)) {
      if (property.type === 'array' || property.type === 'object') {
        property.value = value.slice(
          property.astNode.start!,
          property.astNode.end!,
        );
      }
    }

    objectItems.push({
      id: nanoid(6),
      index: objectItems.length,
      elementIndex,
      source: value.slice(element.start!, element.end!),
      editableProperties,
      jsxBindings,
      jsxFallbacks,
    });
  });

  return { objectItems, primitiveItems, parseError: false };
};
