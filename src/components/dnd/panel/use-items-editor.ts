import { useEffect, useMemo, useState } from 'react';

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
  moveArrayItem,
  moveArrayItems,
  parseArrayExpression,
  parseValue,
  removeArrayItems,
  updateArrayItemProperty,
  updateArrayItemValue,
} from '~/utils/ast';
import { moveSelectedIndices } from '~/utils/selection';

import {
  type PanelBinding,
  type PanelNodeChange,
  resolvePanelBindings,
  withPanelCommit,
} from '../panel-binding';

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
  // Stable while this hook can prove the same item survived a source edit.
  // Structural actions update this identity alongside the source patch, so
  // React keys follow moved/duplicated/deleted rows instead of their positions.
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
  // Appends a copy of the first item of the current `kind`. An array
  // binding stays editable only while it holds at least one item: the shape
  // of a new item comes from its siblings, never from a guess. On an empty
  // array this is a no-op that raises the failure toast, so a custom panel
  // should offer it only when `items` is non-empty, the way the built-in
  // panel does (#316).
  add: () => void;
  move: (elementIndex: number, toIndex: number) => void;
  // Refuses the edit that would remove the last item, keeping the array
  // non-empty and therefore editable.
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
  source: string;
  editableProperties: ReturnType<typeof extractObjectProperties>;
  jsxBindings: Record<string, DataAttrNode[]>;
  jsxFallbacks: Record<string, string>;
}

interface RawPrimitiveItem {
  id: string;
  index: number;
  elementIndex: number;
  source: string;
  value: string | number | boolean | null;
  type: ReturnType<typeof extractNodeValue>['type'];
}

interface ItemIdentityState {
  value: string;
  kind: ItemsEditor['kind'];
  ids: string[];
  signatures: string[];
}

// Pulls the data-bound elements out of one JSX-valued property. A container
// declaring `children` wins outright: it owns the elements below it, so
// listing them separately would offer the same edit twice.
const bindingsInJSX = (source: string): DataAttrNode[] => {
  const nodes = extract(source);
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

const createIdentityState = (
  value: string,
  kind: ItemsEditor['kind'],
  items: Array<RawObjectItem | RawPrimitiveItem>,
  ids: string[] = items.map(item => item.id),
): ItemIdentityState => ({
  value,
  kind,
  ids,
  signatures: items.map(item => item.source),
});

const reconcileIdentityState = (
  current: ItemIdentityState | null,
  value: string,
  kind: ItemsEditor['kind'],
  items: Array<RawObjectItem | RawPrimitiveItem>,
): ItemIdentityState => {
  if (
    current &&
    current.value === value &&
    current.kind === kind &&
    current.ids.length === items.length
  ) {
    return current;
  }

  if (!current || current.kind !== kind) {
    return createIdentityState(value, kind, items);
  }

  const previousCounts = new Map<string, number>();
  const nextCounts = new Map<string, number>();

  current.signatures.forEach(signature => {
    previousCounts.set(signature, (previousCounts.get(signature) ?? 0) + 1);
  });
  items.forEach(item => {
    nextCounts.set(item.source, (nextCounts.get(item.source) ?? 0) + 1);
  });

  const ids = items.map(item => {
    const previousIndex = current.signatures.indexOf(item.source);

    return previousIndex >= 0 &&
      previousCounts.get(item.source) === 1 &&
      nextCounts.get(item.source) === 1
      ? current.ids[previousIndex]!
      : item.id;
  });

  return createIdentityState(value, kind, items, ids);
};

const moveId = (ids: string[], from: number, to: number) => {
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);

  return next;
};

const removeIds = (ids: string[], indices: Set<number>) => {
  return ids.filter((_, index) => !indices.has(index));
};

// The array-editing engine behind the built-in Items panel, exposed so a
// consumer can render their own markup over it (#237/#308 follow-up).
//
// What it saves reimplementing: re-parsing each item's JSX to find nested
// data-bound elements, resolving the binding `render` map, translating
// visible item positions to array element positions before every edit, and
// reconciling the selection after a move or delete (#285). Everything comes
// back as `PanelBinding`s, the same currency `useDndPanel()` and
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
  const rawItems = isPrimitive ? primitiveItems : objectItems;
  const [identityState, setIdentityState] = useState(() =>
    createIdentityState(value, kind, rawItems),
  );
  const identity = useMemo(
    () => reconcileIdentityState(identityState, value, kind, rawItems),
    [identityState, kind, rawItems, value],
  );

  const selection = useMultiSelect(
    isPrimitive ? primitiveItems.length : objectItems.length,
  );

  // `null` means the edit could not be applied.
  const commit = (next: string | null, nextIds?: string[]) => {
    if (next === null) {
      Toast.error('Failed to update this item', {
        description:
          'The source was preserved. Structural edits require a dense array without spreads; use the code editor for unsupported syntax.',
      });

      return false;
    }

    const parsed = parseSource(next);
    const nextItems =
      kind === 'primitive' ? parsed.primitiveItems : parsed.objectItems;

    if (nextIds) {
      setIdentityState(createIdentityState(next, kind, nextItems, nextIds));
    } else {
      setIdentityState(
        createIdentityState(next, kind, nextItems, identity.ids),
      );
    }

    onChange?.(next);

    return true;
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
    add: () => {
      const next = appendArrayItem(value, kind);

      commit(next, next ? [...identity.ids, nanoid(6)] : undefined);
    },

    move: (elementIndex, toIndex) => {
      const items = isPrimitive ? primitiveItems : objectItems;
      const from = items.find(item => item.elementIndex === elementIndex);
      const target = items.find(item => item.index === toIndex);

      if (!from || !target) {
        return;
      }

      const accepted = commit(
        moveArrayItem(value, elementIndex, target.elementIndex),
        moveId(identity.ids, from.index, target.index),
      );
      // Positions shift after a move, but the count doesn't, so
      // `useMultiSelect` never reconciles the set on its own — clear it so a
      // later bulk action can't target the wrong elements. See #285.
      if (accepted) {
        selection.clear();
      }
    },

    remove: elementIndex => {
      const items = isPrimitive ? primitiveItems : objectItems;
      const removed = items.find(item => item.elementIndex === elementIndex);
      const accepted = commit(
        removeArrayItems(value, new Set([elementIndex]), kind),
        removed ? removeIds(identity.ids, new Set([removed.index])) : undefined,
      );
      // Removing an item shifts every position after it; same reasoning.
      if (accepted) {
        selection.clear();
      }
    },

    duplicateSelected: () => {
      const selected = elementIndicesOf(selection.selected);
      const next = duplicateArrayItems(value, selected);
      const copied = rawItems
        .filter(item => selected.has(item.elementIndex))
        .sort((a, b) => a.elementIndex - b.elementIndex)
        .map(() => nanoid(6));

      commit(next, next ? [...identity.ids, ...copied] : undefined);
    },

    moveSelected: direction => {
      const nextIdentity = moveSelectedIndices(
        identity.ids,
        selection.selected,
        direction,
      );
      const result = moveArrayItems(
        value,
        elementIndicesOf(selection.selected),
        direction,
      );

      if (!result) {
        commit(null);
        return;
      }

      // Translate the moved source positions back into the visible kind.
      const parsed = parseArrayExpression(result.code);
      const visible =
        parsed?.elements.flatMap((node, index) =>
          t.isExpression(node) && t.isObjectExpression(node) === !isPrimitive
            ? [index]
            : [],
        ) ?? [];
      selection.replace(
        new Set(
          visible.flatMap((position, index) =>
            result.indices.has(position) ? [index] : [],
          ),
        ),
      );
      commit(result.code, nextIdentity.items);
    },

    removeSelected: () => {
      const accepted = commit(
        removeArrayItems(value, elementIndicesOf(selection.selected), kind),
        removeIds(identity.ids, selection.selected),
      );
      if (accepted) {
        selection.clear();
      }
    },
  };

  // Built fresh each render rather than inside the memo above: these close
  // over `onChange`/`onNodeChange`, and the work is a plain walk of the
  // already-parsed result — no Babel.
  const items: ItemsEditorItem[] = isPrimitive
    ? primitiveItems.map(item => ({
        id: identity.ids[item.index] ?? item.id,
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
        const id = identity.ids[item.index] ?? item.id;
        const properties: PanelBinding[] = Object.entries(
          item.editableProperties,
        ).map(([key, prop]) => {
          const leaf = resolveLeaf(render, key);

          return {
            id: `item-${id}-${key}`,
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
              const source = resolvePanelBindings(node);

              if (!source) {
                return [];
              }

              return [
                {
                  id: source.id,
                  tagName: source.tagName,
                  bindings: withPanelCommit(source.bindings, onNodeChange),
                },
              ];
            }),
          })),
          ...Object.entries(item.jsxFallbacks).map(([property, code]) => ({
            property,
            elements: [],
            fallback: {
              id: `item-${id}-${property}-jsx`,
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
          id,
          index: item.index,
          elementIndex: item.elementIndex,
          properties,
          nested,
        };
      });

  return { kind, items, selection, actions, parseError };
};
