import { useEffect, useMemo, useRef, useState } from 'react';

import * as t from '@babel/types';
import type { useMultiSelect } from '@jbpark/use-hooks';
import { nanoid } from 'nanoid';

import { useLiveMessages } from '~/components/context/messages';
import { canStructurallyEditArray } from '~/utils/ast/array-source';
import { findEditableChildren } from '~/utils/ast/binding';
import { extract } from '~/utils/ast/extract';
import {
  appendArrayItem,
  duplicateArrayItems,
  moveArrayItem,
  moveArrayItems,
  removeArrayItems,
  updateArrayItemProperty,
  updateArrayItemValue,
} from '~/utils/ast/items';
import {
  type BindingOptions,
  type BindingRenderMap,
  type DataAttrNode,
} from '~/utils/ast/types';
import { parseValue } from '~/utils/ast/value';
import {
  canLosslesslyEvaluateSource,
  extractNodeValue,
  extractObjectProperties,
  parseArrayExpression,
} from '~/utils/ast/value';
import { moveSelectedIndices } from '~/utils/selection';

import { useDndEditOptions } from '../edit-options';
import {
  type PanelBinding,
  type PanelNodeChange,
  resolvePanelBindings,
  resolveRenderEntry,
  toBindingFields,
  withPanelCommit,
} from '../panel-binding';
import {
  createIdentityState,
  moveId,
  reconcileIdentityState,
  removeIds,
} from './item-identity';
import {
  selectionAfter,
  useStructuralSelection,
} from './use-structural-selection';

// A data-bound element inside a JSX-valued item property. `bindings`
// doesn't list these, because `extract()` doesn't read into attribute
// values, so this hook extracts the property's JSX itself (#308).
export interface DndItemsNestedElement {
  // The element's `data-id`, which is what commits address it by.
  id: string;
  tagName: string;
  bindings: PanelBinding[];
}

export interface DndItemsNestedGroup {
  // The item property holding this JSX (e.g. `children`, `label`).
  property: string;
  elements: DndItemsNestedElement[];
  // Set instead of `elements` when the JSX has no bindings: a `jsx` binding
  // for editing the property's source (#298).
  fallback?: PanelBinding;
}

export interface DndItemsItem {
  // Stays the same while the hook can tell the item survived an edit, so
  // React keys follow an item that moves, is copied or is deleted.
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
  nested: DndItemsNestedGroup[];
  // A primitive item's own value. Absent on object items.
  value?: PanelBinding;
}

export interface DndItemsActions {
  // Appends a copy of the first item of the current `kind`, since a new
  // item's shape comes from its siblings. On an empty array it fails with
  // the error toast, so offer it only when `items` isn't empty, as the
  // built-in panel does (#316).
  add: () => void;
  move: (elementIndex: number, toIndex: number) => void;
  // Refuses to remove the last item, so the array stays editable.
  remove: (elementIndex: number) => void;
  duplicateSelected: () => void;
  moveSelected: (direction: 'up' | 'down') => void;
  removeSelected: () => void;
}

// Which items show their fields. Keyed by `DndItemsItem.id`, so an item
// keeps its state when it moves, a sibling changes, or another item is
// added or removed. Every item starts expanded, including one added later.
// The hook only holds the state; drawing a collapsed item is the panel's job.
export interface DndItemsExpansion {
  // The ids of the current items that are expanded, in item order.
  expandedIds: string[];
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
  // Expands exactly these items and collapses the rest. Pass every id to
  // expand all, or `[]` to collapse all.
  setExpanded: (ids: string[]) => void;
}

export interface DndItems {
  // Which kind the array is being edited as. The panel shows one kind at a
  // time; an array holding both is treated as objects, and the primitives
  // stay untouched rather than being dropped.
  kind: 'object' | 'primitive';
  items: DndItemsItem[];
  // `@jbpark/use-hooks`' multi-select state, re-exposed as-is: `selected`,
  // `toggle`, `isSelected`, `clear`, `replace`. Its indices are item
  // `index` values, not `elementIndex` — the actions below translate.
  selection: ReturnType<typeof useMultiSelect>;
  expansion: DndItemsExpansion;
  actions: DndItemsActions;
  // Whether the current source can be moved, copied, removed or appended
  // without losing syntax. Value/property edits can remain available when
  // this is false. Every action revalidates the source before committing.
  canEditStructure: boolean;
  // The source didn't parse as an array expression. `items` is empty; the
  // built-in panel also raises a toast.
  parseError: boolean;
}

export interface DndItemsOptions {
  render?: BindingRenderMap;
  // Commits the new array source after an edit.
  onChange?: (value: string) => void;
  // Commits an edit to a nested element by its own `data-id` (#308).
  onNodeChange?: PanelNodeChange;
}

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

// What an edit reads: this render's array, or the one a same-tick commit
// left behind (#451), with the item identity and selection that go with it.
interface Snapshot {
  value: string;
  items: Array<RawObjectItem | RawPrimitiveItem>;
  ids: string[];
  selected: Set<number>;
}

interface PendingCommit {
  // The render `value` the commit was built on.
  from: string;
  value: string;
  ids: string[];
  selected: Set<number>;
}

const createPendingCommit = () => {
  let current: PendingCommit | null = null;

  return {
    read: () => current,
    write: (next: PendingCommit) => {
      current = next;
    },
    clear: () => {
      current = null;
    },
  };
};

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

// Parses the array. Kept apart from building the bindings, so the parse is
// memoized on the source while the callbacks stay current every render.
const parseSource = (value: string, bindingOptions?: BindingOptions) => {
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

// What the built-in Items editor runs on, for a custom panel's own markup.
// It finds the nested data-bound elements in each item, applies the
// `render` map, maps visible positions to array positions for every edit,
// and keeps the selection right after a move or delete (#285). Fields come
// back as `PanelBinding`s, so `Live.Dnd.Field` can render them.
export const useDndItems = (
  value: string,
  { render, onChange, onNodeChange }: DndItemsOptions = {},
): DndItems => {
  const { reportError, bindingOptions } = useDndEditOptions();
  const messages = useLiveMessages();
  const { objectItems, primitiveItems, parseError } = useMemo(
    () => parseSource(value, bindingOptions),
    [value, bindingOptions],
  );
  const canEditStructure = useMemo(
    () => canStructurallyEditArray(value),
    [value],
  );

  // Read through refs, so the effect below reports each parse failure once,
  // even when the host passes a new `onEditError` or new messages.
  const reportErrorRef = useRef(reportError);
  const messagesRef = useRef(messages);

  useEffect(() => {
    reportErrorRef.current = reportError;
    messagesRef.current = messages;
  });

  useEffect(() => {
    if (parseError) {
      reportErrorRef.current({
        type: 'parse',
        target: 'items',
        title: messagesRef.current.editErrors.itemsParseFailed,
        description: messagesRef.current.editErrors.checkConsole,
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

  // Collapsed rather than expanded ids, so an item this hook hasn't seen
  // yet, such as one just added, starts expanded. Ids are never reused, so
  // one left behind by a removed item can't collapse another.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const { selection, record } = useStructuralSelection(
    isPrimitive ? primitiveItems.length : objectItems.length,
    value,
  );

  // The array the last commit produced, with its item ids and selection,
  // and the render `value` it was built on. Edits read `latest()`, so a
  // second edit in the same tick builds on the first instead of undoing it
  // (#451). Cleared after each render, when the new `value` takes over, as
  // in `useSectionDocument` (#450).
  //
  // Held in `useState`, not a ref: the bindings built during render close
  // over `latest()`, and the React compiler treats that as reading a ref in
  // render.
  const [pending] = useState(createPendingCommit);

  useEffect(() => {
    pending.clear();
  });

  const latest = (): Snapshot => {
    const last = pending.read();

    if (last?.from !== value) {
      return {
        value,
        items: rawItems,
        ids: identity.ids,
        selected: selection.selected,
      };
    }

    const parsed = parseSource(last.value);

    return {
      value: last.value,
      items: isPrimitive ? parsed.primitiveItems : parsed.objectItems,
      ids: last.ids,
      selected: last.selected,
    };
  };

  // Where the item this render showed at `elementIndex` is in `snapshot`,
  // followed by identity so an edit lands on the same item after a
  // same-tick move. `null` when a same-tick edit removed it; `undefined`
  // when this render has no such item, so the caller keeps the position it
  // was given.
  const locate = (snapshot: Snapshot, elementIndex: number) => {
    const shown = rawItems.find(item => item.elementIndex === elementIndex);

    if (!shown) {
      return undefined;
    }

    const index = snapshot.ids.indexOf(identity.ids[shown.index]!);

    return index >= 0 ? snapshot.items[index] : null;
  };

  // `null` means the edit failed. Otherwise the selection becomes
  // `nextSelection` now, and again when this source comes back as `value`;
  // any other new `value` clears it (`useStructuralSelection`).
  const commit = (
    snapshot: Snapshot,
    next: string | null,
    nextIds: string[] | undefined,
    nextSelection: Set<number>,
  ) => {
    if (next === null) {
      reportError({
        type: 'items',
        title: messages.editErrors.itemUpdateFailed,
        description: messages.editErrors.itemUpdateFailedDetail,
      });

      return false;
    }

    const parsed = parseSource(next);
    const nextItems =
      kind === 'primitive' ? parsed.primitiveItems : parsed.objectItems;
    const ids = nextIds ?? snapshot.ids;

    pending.write({
      from: value,
      value: next,
      ids,
      selected: nextSelection,
    });
    setIdentityState(createIdentityState(next, kind, nextItems, ids));
    record(nextSelection, revision => revision === next, { now: true });
    onChange?.(next);

    return true;
  };

  // Selection indices count visible items; the AST functions take array
  // positions. Converting keeps hidden items from being lost.
  const elementIndicesOf = (snapshot: Snapshot, indices: Set<number>) =>
    new Set(
      snapshot.items
        .filter(item => indices.has(item.index))
        .map(item => item.elementIndex),
    );

  const updateProperty = (
    elementIndex: number,
    propertyKey: string,
    next: unknown,
  ) => {
    const snapshot = latest();
    const item = locate(snapshot, elementIndex);

    if (item === null) {
      return;
    }

    // A value edit moves nothing, so the selection stands.
    commit(
      snapshot,
      updateArrayItemProperty(
        snapshot.value,
        item?.elementIndex ?? elementIndex,
        propertyKey,
        next,
        render,
      ),
      undefined,
      new Set(snapshot.selected),
    );
  };

  const updateValue = (elementIndex: number, next: unknown) => {
    const snapshot = latest();
    const item = locate(snapshot, elementIndex);

    if (item === null) {
      return;
    }

    commit(
      snapshot,
      updateArrayItemValue(
        snapshot.value,
        item?.elementIndex ?? elementIndex,
        next,
      ),
      undefined,
      new Set(snapshot.selected),
    );
  };

  const actions: DndItemsActions = {
    add: () => {
      const snapshot = latest();
      const next = appendArrayItem(snapshot.value, kind);

      commit(
        snapshot,
        next,
        next ? [...snapshot.ids, nanoid(6)] : undefined,
        selectionAfter(
          { type: 'append' },
          snapshot.selected,
          snapshot.items.length,
        ),
      );
    },

    move: (elementIndex, toIndex) => {
      const snapshot = latest();
      const from = locate(snapshot, elementIndex);
      const target = snapshot.items.find(item => item.index === toIndex);

      if (!from || !target) {
        return;
      }

      // A move shifts positions, so clear the selection rather than leave it
      // on other items (#285).
      commit(
        snapshot,
        moveArrayItem(snapshot.value, from.elementIndex, target.elementIndex),
        moveId(snapshot.ids, from.index, target.index),
        new Set(),
      );
    },

    remove: elementIndex => {
      const snapshot = latest();
      const removed = locate(snapshot, elementIndex);

      if (removed === null) {
        return;
      }

      // A removal shifts later positions too, so clear the selection.
      commit(
        snapshot,
        removeArrayItems(
          snapshot.value,
          new Set([removed?.elementIndex ?? elementIndex]),
          kind,
        ),
        removed ? removeIds(snapshot.ids, new Set([removed.index])) : undefined,
        new Set(),
      );
    },

    duplicateSelected: () => {
      const snapshot = latest();
      const selected = elementIndicesOf(snapshot, snapshot.selected);
      const next = duplicateArrayItems(snapshot.value, selected);
      const copied = snapshot.items
        .filter(item => selected.has(item.elementIndex))
        .sort((a, b) => a.elementIndex - b.elementIndex)
        .map(() => nanoid(6));

      commit(
        snapshot,
        next,
        next ? [...snapshot.ids, ...copied] : undefined,
        selectionAfter(
          { type: 'duplicate', indices: [...snapshot.selected] },
          snapshot.selected,
          snapshot.items.length,
        ),
      );
    },

    moveSelected: direction => {
      const snapshot = latest();
      const nextIdentity = moveSelectedIndices(
        snapshot.ids,
        snapshot.selected,
        direction,
      );
      const result = moveArrayItems(
        snapshot.value,
        elementIndicesOf(snapshot, snapshot.selected),
        direction,
      );

      if (!result) {
        commit(snapshot, null, undefined, snapshot.selected);
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
      // The moved block, mapped back from element positions: in a mixed
      // array a step can pass a hidden element, so this is not the same as
      // shifting the visible indices.
      commit(
        snapshot,
        result.code,
        nextIdentity.items,
        new Set(
          visible.flatMap((position, index) =>
            result.indices.has(position) ? [index] : [],
          ),
        ),
      );
    },

    removeSelected: () => {
      const snapshot = latest();

      commit(
        snapshot,
        removeArrayItems(
          snapshot.value,
          elementIndicesOf(snapshot, snapshot.selected),
          kind,
        ),
        removeIds(snapshot.ids, snapshot.selected),
        new Set(),
      );
    },
  };

  // Built every render, outside the memo, because they close over
  // `onChange` and `onNodeChange`. A cheap walk with no parsing.
  const items: DndItemsItem[] = isPrimitive
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
          rawValue:
            item.type === 'unknown' ? item.source : String(item.value ?? ''),
          canEditValue: canLosslesslyEvaluateSource(item.source),
          onChange: next => updateValue(item.elementIndex, next),
        },
      }))
    : objectItems.map(item => {
        const id = identity.ids[item.index] ?? item.id;
        const properties: PanelBinding[] = Object.entries(
          item.editableProperties,
        ).map(([key, prop]) => {
          const binding = resolveRenderEntry(render, key);
          const propertySource = value.slice(
            prop.astNode.start!,
            prop.astNode.end!,
          );

          return {
            ...toBindingFields(binding),
            id: `item-${id}-${key}`,
            // Over the leaf's own `meta`, so the property's real type wins
            // over an authored `valueType`.
            meta: { ...binding.meta, valueType: prop.type },
            value: parseValue(String(prop.value)),
            rawValue:
              prop.type === 'unknown' ? propertySource : String(prop.value),
            canEditValue: canLosslesslyEvaluateSource(propertySource),
            onChange: next => updateProperty(item.elementIndex, key, next),
          };
        });

        const nested: DndItemsNestedGroup[] = [
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
              canEditValue: true,
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

  const expansion: DndItemsExpansion = {
    expandedIds: items.flatMap(item =>
      collapsed.has(item.id) ? [] : [item.id],
    ),
    isExpanded: id => !collapsed.has(id),
    toggle: id =>
      setCollapsed(previous => {
        const next = new Set(previous);

        if (!next.delete(id)) {
          next.add(id);
        }

        return next;
      }),
    setExpanded: ids => {
      const expanded = new Set(ids);

      setCollapsed(
        new Set(
          items.flatMap(item => (expanded.has(item.id) ? [] : [item.id])),
        ),
      );
    },
  };

  return {
    kind,
    items,
    selection,
    expansion,
    actions,
    canEditStructure,
    parseError,
  };
};
