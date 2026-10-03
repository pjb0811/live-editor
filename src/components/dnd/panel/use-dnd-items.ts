import { useEffect, useMemo, useRef, useState } from 'react';

import * as t from '@babel/types';
import type { useMultiSelect } from '@jbpark/use-hooks';
import { nanoid } from 'nanoid';

import {
  type BindingOptions,
  type BindingRenderMap,
  type DataAttrNode,
  appendArrayItem,
  canLosslesslyEvaluateSource,
  canStructurallyEditArray,
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
  selectionAfter,
  useStructuralSelection,
} from './use-structural-selection';

// One data-bound element discovered inside a JSX-valued item property.
// These are the elements the top-level `bindings` array can't reach —
// `extract()` doesn't walk into an attribute expression, so they're found
// by re-extracting the property's own JSX here (#308).
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
  // Set instead of `elements` when the JSX parsed but declared no binding
  // at all. Editing the property's raw source is the only thing left to
  // offer, so this is a `jsx`-typed binding over that source (#298).
  fallback?: PanelBinding;
}

export interface DndItemsItem {
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
  nested: DndItemsNestedGroup[];
  // A primitive item's own value. Absent on object items.
  value?: PanelBinding;
}

export interface DndItemsActions {
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
  // Commits a whole new array source. Every mutation here goes through
  // `~/utils/ast`'s item functions, which re-parse the source and hand back
  // a string, so no AST node is held or edited across renders.
  onChange?: (value: string) => void;
  // Commits an edit to one nested element, addressed by its own `data-id`.
  // A single binding's `onChange` can't express this — see #308.
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

interface ItemIdentityState {
  value: string;
  kind: DndItems['kind'];
  ids: string[];
  signatures: string[];
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

// The parse. Split from the binding construction below so the Babel work is
// memoized on the source string alone, while the callbacks the bindings
// close over stay current on every render.
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

const createIdentityState = (
  value: string,
  kind: DndItems['kind'],
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
  kind: DndItems['kind'],
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
export const useDndItems = (
  value: string,
  { render, onChange, onNodeChange }: DndItemsOptions = {},
): DndItems => {
  const { reportError, bindingOptions } = useDndEditOptions();
  const { objectItems, primitiveItems, parseError } = useMemo(
    () => parseSource(value, bindingOptions),
    [value, bindingOptions],
  );
  const canEditStructure = useMemo(
    () => canStructurallyEditArray(value),
    [value],
  );

  // Read through a ref so the effect below fires once per parse failure, not
  // again on every render a host passes a fresh inline `onEditError`.
  const reportErrorRef = useRef(reportError);

  useEffect(() => {
    reportErrorRef.current = reportError;
  });

  useEffect(() => {
    if (parseError) {
      reportErrorRef.current({
        type: 'parse',
        target: 'items',
        title: 'Failed to parse items',
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

  // The array the last commit produced, with the identity and selection that
  // go with it, tagged with the render `value` it was built on. Every edit
  // below computes a whole new array from a snapshot, and the host only
  // hands the result back as `value` on the next render, so two edits in the
  // same tick both started from this render's array and the second dropped
  // the first (#451). Edits read `latest()` instead.
  //
  // Dropped after each render, as `useSectionDocument` does for the document
  // (#450): from then on the rendered `value` is the source of truth again,
  // including when the host didn't accept the commit.
  //
  // Held in a `useState` box rather than a ref: the item bindings below are
  // built during render and close over `latest()`, which the compiler reads
  // as a ref access in render even though only their `onChange` calls it —
  // the same reason `useSectionDocument` keeps its preview cache this way.
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

  // `null` means the edit could not be applied. `nextSelection` is where the
  // selection stands once it is: applied now, since a non-null `next` means
  // the edit succeeded, and again when this exact source comes back as
  // `value`. Any other new `value` clears it (useStructuralSelection).
  const commit = (
    snapshot: Snapshot,
    next: string | null,
    nextIds: string[] | undefined,
    nextSelection: Set<number>,
  ) => {
    if (next === null) {
      reportError({
        type: 'items',
        title: 'Failed to update this item',
        description:
          'The source was preserved. Structural edits require a dense array without spreads; use the code editor for unsupported syntax.',
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

  // Selection indices are positions among the visible items; every AST
  // function addresses element positions. Keeping the two apart is what
  // stops an edit from dropping the items that aren't on screen.
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

      // Positions shift after a move but the count doesn't, so the
      // selection is cleared rather than left on the wrong items (#285).
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

      // Removing an item shifts every position after it; same reasoning.
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

  // Built fresh each render rather than inside the memo above: these close
  // over `onChange`/`onNodeChange`, and the work is a plain walk of the
  // already-parsed result — no Babel.
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
            // Merged over the leaf's own metadata, never under it: a consumer
            // labels the control with the property's actual kind, as the
            // built-in panel does, so an authored `valueType` can't shadow it.
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
