import { useEffect, useMemo } from 'react';

import * as t from '@babel/types';
import { Toast } from '@jbpark/ui-kit';
import { useMultiSelect } from '@jbpark/use-hooks';
import { nanoid } from 'nanoid';

import {
  type BindingRenderLeaf,
  type BindingRenderMap,
  type DataAttrNode,
  appendArrayItem,
  duplicateArrayItems,
  extract,
  extractNodeValue,
  extractObjectProperties,
  findEditableChildren,
  generateCode,
  getCurrentValue,
  getStructuredValue,
  moveArrayItem,
  moveArrayItems,
  parseArrayExpression,
  parseBinding,
  parseValue,
  removeArrayItems,
  updateArrayItemProperty,
  updateArrayItemValue,
} from '~/utils/ast';

import type { PanelBinding, PanelNodeChange } from '../dnd';

// One data-bound element discovered inside a JSX-valued item property.
// These are the elements the top-level `bindings` array can't reach —
// `extract()` doesn't walk into an attribute expression, so they're found
// by re-extracting the property's own JSX here (#308).
export interface ItemsEditorNestedElement {
  // The element's `data-id`, which is what commits address it by.
  id: string;
  tagName: string;
  bindings: PanelBinding[];
}

export interface ItemsEditorNestedGroup {
  // The item property holding this JSX (e.g. `children`, `label`).
  property: string;
  elements: ItemsEditorNestedElement[];
  // Set instead of `elements` when the JSX parsed but declared no binding
  // at all. Editing the property's raw source is the only thing left to
  // offer, so this is a `jsx`-typed binding over that source (#298).
  fallback?: PanelBinding;
}

export interface ItemsEditorItem {
  // Stable only for this parse of `value` — regenerated whenever the source
  // string changes. Fine as a React key, not as an identity across edits;
  // use `elementIndex` for that.
  id: string;
  // Position among the visible items of this kind, which is what selection
  // indices refer to.
  index: number;
  // Position in the array's elements, which is what every `~/utils/ast`
  // item function addresses. Differs from `index` when the array mixes
  // objects and primitives.
  elementIndex: number;
  // An object item's plain (non-JSX) properties, already resolved through
  // the binding `render` map.
  properties: PanelBinding[];
  // An object item's JSX-valued properties.
  nested: ItemsEditorNestedGroup[];
  // A primitive item's own value. Absent on object items.
  value?: PanelBinding;
}

export interface ItemsEditorActions {
  add: () => void;
  move: (elementIndex: number, toIndex: number) => void;
  remove: (elementIndex: number) => void;
  duplicateSelected: () => void;
  moveSelected: (direction: 'up' | 'down') => void;
  removeSelected: () => void;
}

export interface ItemsEditor {
  // Which kind the array is being edited as. The panel shows one kind at a
  // time; an array holding both is treated as objects, and the primitives
  // stay untouched rather than being dropped.
  kind: 'object' | 'primitive';
  items: ItemsEditorItem[];
  // `@jbpark/use-hooks`' multi-select state, re-exposed as-is: `selected`,
  // `toggle`, `isSelected`, `clear`, `replace`. Its indices are item
  // `index` values, not `elementIndex` — the actions below translate.
  selection: ReturnType<typeof useMultiSelect>;
  actions: ItemsEditorActions;
  // The source didn't parse as an array expression. `items` is empty; the
  // built-in panel also raises a toast.
  parseError: boolean;
}

export interface ItemsEditorOptions {
  render?: BindingRenderMap;
  // Commits a whole new array source. Every mutation here goes through
  // `~/utils/ast`'s item functions, which re-parse the source and hand back
  // a string, so no AST node is held or edited across renders.
  onChange?: (value: string) => void;
  // Commits an edit to one nested element, addressed by its own `data-id`.
  // A single binding's `onChange` can't express this — see #308.
  onNodeChange?: PanelNodeChange;
}

const resolveLeaf = (
  render: BindingRenderMap | undefined,
  key: string,
): BindingRenderLeaf | null => {
  const leaf = render?.[key];

  return leaf && 'type' in leaf ? (leaf as BindingRenderLeaf) : null;
};

const resolveMap = (
  render: BindingRenderMap | undefined,
  key: string,
): BindingRenderMap | undefined => {
  const leaf = render?.[key];

  return leaf && !('type' in leaf) ? (leaf as BindingRenderMap) : undefined;
};

interface RawObjectItem {
  id: string;
  index: number;
  elementIndex: number;
  editableProperties: ReturnType<typeof extractObjectProperties>;
  jsxBindings: Record<string, DataAttrNode[]>;
  jsxFallbacks: Record<string, string>;
}

interface RawPrimitiveItem {
  id: string;
  index: number;
  elementIndex: number;
  value: string | number | boolean | null;
  type: ReturnType<typeof extractNodeValue>['type'];
}

// Pulls the data-bound elements out of one JSX-valued property. A container
// declaring `children` wins outright: it owns the elements below it, so
// listing them separately would offer the same edit twice.
const bindingsInJSX = (node: t.Expression): DataAttrNode[] => {
  const nodes = extract(generateCode(node));
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

// The parse. Split from the binding construction below so the Babel work is
// memoized on the source string alone, while the callbacks the bindings
// close over stay current on every render.
const parseSource = (value: string) => {
  const ast = parseArrayExpression(value);

  if (!ast) {
    return { objectItems: [], primitiveItems: [], parseError: true };
  }

  const objectItems: RawObjectItem[] = [];
  const primitiveItems: RawPrimitiveItem[] = [];
  const elements = ast.elements.filter((element): element is t.Expression =>
    Boolean(element),
  );

  elements.forEach((element, elementIndex) => {
    if (!t.isObjectExpression(element)) {
      const extracted = extractNodeValue(element);

      primitiveItems.push({
        id: nanoid(6),
        index: primitiveItems.length,
        elementIndex,
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
        const found = bindingsInJSX(prop.value);

        if (found.length > 0) {
          jsxBindings[propertyName] = found;
        } else {
          jsxFallbacks[propertyName] = generateCode(prop.value);
        }
      } catch (error) {
        console.error(
          `Failed to parse JSX in property '${propertyName}':`,
          error,
        );
      }
    });

    objectItems.push({
      id: nanoid(6),
      index: objectItems.length,
      elementIndex,
      editableProperties: extractObjectProperties(element),
      jsxBindings,
      jsxFallbacks,
    });
  });

  return { objectItems, primitiveItems, parseError: false };
};

// The array-editing engine behind the built-in Items panel, exposed so a
// consumer can render their own markup over it (#237/#308 follow-up).
//
// What it saves reimplementing: re-parsing each item's JSX to find nested
// data-bound elements, resolving the binding `render` map, translating
// visible item positions to array element positions before every edit, and
// reconciling the selection after a move or delete (#285). Everything comes
// back as `PanelBinding`s, the same currency `renderPanel` and
// `Live.Dnd.Field` already speak, so nothing here requires touching Babel.
export const useItemsEditor = (
  value: string,
  { render, onChange, onNodeChange }: ItemsEditorOptions = {},
): ItemsEditor => {
  const { objectItems, primitiveItems, parseError } = useMemo(
    () => parseSource(value),
    [value],
  );

  useEffect(() => {
    if (parseError) {
      Toast.error('Failed to parse items', {
        description: 'Check the console for details.',
      });
    }
  }, [parseError]);

  const kind =
    primitiveItems.length > 0 && objectItems.length === 0
      ? 'primitive'
      : 'object';
  const isPrimitive = kind === 'primitive';

  const selection = useMultiSelect(
    isPrimitive ? primitiveItems.length : objectItems.length,
  );

  // `null` means the edit could not be applied.
  const commit = (next: string | null) => {
    if (next === null) {
      Toast.error('Failed to update this item', {
        description: 'Check the console for details.',
      });
      return;
    }

    onChange?.(next);
  };

  // Selection indices are positions among the visible items; every AST
  // function addresses element positions. Keeping the two apart is what
  // stops an edit from dropping the items that aren't on screen.
  const elementIndicesOf = (indices: Set<number>) => {
    const items = isPrimitive ? primitiveItems : objectItems;

    return new Set(
      items
        .filter(item => indices.has(item.index))
        .map(item => item.elementIndex),
    );
  };

  const updateProperty = (
    elementIndex: number,
    propertyKey: string,
    next: unknown,
  ) => {
    commit(
      updateArrayItemProperty(value, elementIndex, propertyKey, next, render),
    );
  };

  const actions: ItemsEditorActions = {
    add: () => commit(appendArrayItem(value, kind)),

    move: (elementIndex, toIndex) => {
      const items = isPrimitive ? primitiveItems : objectItems;
      const target = items.find(item => item.index === toIndex);

      if (!target) {
        return;
      }

      commit(moveArrayItem(value, elementIndex, target.elementIndex));
      // Positions shift after a move, but the count doesn't, so
      // `useMultiSelect` never reconciles the set on its own — clear it so a
      // later bulk action can't target the wrong elements. See #285.
      selection.clear();
    },

    remove: elementIndex => {
      commit(removeArrayItems(value, new Set([elementIndex]), kind));
      // Removing an item shifts every position after it; same reasoning.
      selection.clear();
    },

    duplicateSelected: () =>
      commit(duplicateArrayItems(value, elementIndicesOf(selection.selected))),

    moveSelected: direction => {
      const result = moveArrayItems(
        value,
        elementIndicesOf(selection.selected),
        direction,
      );

      if (!result) {
        commit(null);
        return;
      }

      // Element positions, which match selection indices for the
      // all-one-kind arrays this is built for.
      selection.replace(result.indices);
      commit(result.code);
    },

    removeSelected: () => {
      commit(
        removeArrayItems(value, elementIndicesOf(selection.selected), kind),
      );
      selection.clear();
    },
  };

  // Built fresh each render rather than inside the memo above: these close
  // over `onChange`/`onNodeChange`, and the work is a plain walk of the
  // already-parsed result — no Babel.
  const items: ItemsEditorItem[] = isPrimitive
    ? primitiveItems.map(item => ({
        id: item.id,
        index: item.index,
        elementIndex: item.elementIndex,
        properties: [],
        nested: [],
        value: {
          id: `primitive-${item.id}`,
          label: `item-${item.index}`,
          property: item.type,
          value: item.value ?? '',
          rawValue: String(item.value ?? ''),
          onChange: next =>
            commit(updateArrayItemValue(value, item.elementIndex, next)),
        },
      }))
    : objectItems.map(item => {
        const properties: PanelBinding[] = Object.entries(
          item.editableProperties,
        ).map(([key, prop]) => {
          const leaf = resolveLeaf(render, key);

          return {
            id: `item-${item.id}-${key}`,
            label: key,
            property: leaf ? (leaf.property ?? (leaf.type as string)) : key,
            type: leaf?.type,
            render: leaf ? leaf.render : resolveMap(render, key),
            value: parseValue(String(prop.value)),
            rawValue: String(prop.value),
            // Carried through so a consumer can label the control with the
            // property's actual kind, as the built-in panel does.
            meta: { valueType: prop.type },
            onChange: next => updateProperty(item.elementIndex, key, next),
          };
        });

        const nested: ItemsEditorNestedGroup[] = [
          ...Object.entries(item.jsxBindings).map(([property, nodes]) => ({
            property,
            elements: nodes.flatMap(node => {
              const id = node.dataAttributes.find(
                a => a.name === 'data-id',
              )?.value;
              const attr = node.dataAttributes.find(
                a => a.name === 'data-binding',
              )?.value;

              if (!id || !attr) {
                return [];
              }

              const parsed = node.bindings ?? parseBinding(attr);

              if (!parsed.length) {
                return [];
              }

              return [
                {
                  id,
                  tagName: node.tagName || 'element',
                  bindings: parsed.map(binding => ({
                    id,
                    label: binding.label,
                    property: binding.property,
                    type: binding.type,
                    widget: binding.widget,
                    options: binding.options,
                    render: binding.render,
                    min: binding.min,
                    max: binding.max,
                    pattern: binding.pattern,
                    required: binding.required,
                    meta: binding.meta,
                    value: getStructuredValue(
                      node,
                      binding.property,
                      binding.type,
                    ),
                    rawValue: getCurrentValue(node, binding.property),
                    onChange: (next: unknown) =>
                      onNodeChange?.({
                        id,
                        label: binding.label,
                        property: binding.property,
                        value: next,
                      }),
                  })),
                },
              ];
            }),
          })),
          ...Object.entries(item.jsxFallbacks).map(([property, code]) => ({
            property,
            elements: [],
            fallback: {
              id: `item-${item.id}-${property}-jsx`,
              label: property,
              property,
              type: 'jsx' as const,
              value: code,
              rawValue: code,
              onChange: (next: unknown) =>
                updateProperty(item.elementIndex, property, next),
            },
          })),
        ];

        return {
          id: item.id,
          index: item.index,
          elementIndex: item.elementIndex,
          properties,
          nested,
        };
      });

  return { kind, items, selection, actions, parseError };
};
