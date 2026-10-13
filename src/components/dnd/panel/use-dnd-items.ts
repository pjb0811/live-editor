import { useEffect, useMemo, useState } from 'react';

import * as t from '@babel/types';
import {
  useLatest,
  type useMultiSelect,
  usePendingCommit,
} from '@jbpark/use-hooks';
import { nanoid } from 'nanoid';

import { useLiveMessages } from '~/components/context/messages';
import { canStructurallyEditArray } from '~/utils/ast/array-source';
import {
  appendArrayItem,
  duplicateArrayItems,
  moveArrayItem,
  moveArrayItems,
  removeArrayItems,
  updateArrayItemProperty,
  updateArrayItemValue,
} from '~/utils/ast/items';
import { type BindingRenderMap } from '~/utils/ast/types';
import { parseArrayExpression } from '~/utils/ast/value';
import { moveSelectedIndices } from '~/utils/selection';

import { useDndEditOptions } from '../edit-options';
import { type PanelBinding, type PanelNodeChange } from '../panel-binding';
import { toItemBindings } from './item-bindings';
import {
  createIdentityState,
  moveId,
  reconcileIdentityState,
  removeIds,
} from './item-identity';
import {
  type RawObjectItem,
  type RawPrimitiveItem,
  parseSource,
} from './items-source';
import { useItemExpansion } from './use-item-expansion';
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
  // Whether `count` more items (default 1) stay within `maxItems`, and
  // whether removing `count` leaves at least `minItems` (at least 1). The
  // actions refuse an edit past either limit.
  canAddItems: (count?: number) => boolean;
  canRemoveItems: (count?: number) => boolean;
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
  // The binding's item count limits (`BindingFieldSpec.minItems` and
  // `maxItems`).
  minItems?: number;
  maxItems?: number;
}

// What an edit reads: this render's array, or the one a same-tick commit
// left behind (#451), with the item identity and selection that go with it.
interface Snapshot {
  value: string;
  items: Array<RawObjectItem | RawPrimitiveItem>;
  ids: string[];
  selected: Set<number>;
}

// What a commit leaves for the next edit in the same tick.
interface PendingCommit {
  value: string;
  ids: string[];
  selected: Set<number>;
}

// What the built-in Items editor runs on, for a custom panel's own markup.
// It finds the nested data-bound elements in each item, applies the
// `render` map, maps visible positions to array positions for every edit,
// and keeps the selection right after a move or delete (#285). Fields come
// back as `PanelBinding`s, so `Live.Dnd.Field` can render them.
export const useDndItems = (
  value: string,
  { render, onChange, onNodeChange, minItems, maxItems }: DndItemsOptions = {},
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
  const reportErrorRef = useLatest(reportError);
  const messagesRef = useLatest(messages);

  useEffect(() => {
    if (parseError) {
      reportErrorRef.current({
        type: 'parse',
        target: 'items',
        title: messagesRef.current.editErrors.itemsParseFailed,
        description: messagesRef.current.editErrors.checkConsole,
      });
    }
  }, [parseError, reportErrorRef, messagesRef]);

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

  const { selection, record } = useStructuralSelection(
    isPrimitive ? primitiveItems.length : objectItems.length,
    value,
  );

  // The array the last commit produced, with its item ids and selection,
  // read only while `value` is still the render value it was built on. Edits
  // read `latest()`, so a second edit in the same tick builds on the first
  // instead of undoing it (#451). Dropped after each render, when the new
  // `value` takes over, as in `useSectionDocument` (#450).
  const pending = usePendingCommit<string, PendingCommit>(value);

  const latest = (): Snapshot => {
    const last = pending.read();

    if (!last) {
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
      value: next,
      ids,
      selected: nextSelection,
    });
    setIdentityState(createIdentityState(next, kind, nextItems, ids));
    record(nextSelection, revision => revision === next, { now: true });
    onChange?.(next);

    return true;
  };

  // The editor never removes the last item (#316), whatever `minItems` says.
  const fewestItems = Math.max(minItems ?? 1, 1);

  // Reports and returns `true` when an edit would leave `length` items,
  // outside the binding's limits. Below 1 without a `minItems` is left to
  // the AST functions, which refuse it with the usual error.
  const refuseCount = (length: number) => {
    const description =
      maxItems !== undefined && length > maxItems
        ? messages.validation.maxItems(maxItems)
        : minItems !== undefined && length < fewestItems
          ? messages.validation.minItems(fewestItems)
          : null;

    if (description === null) {
      return false;
    }

    reportError({
      type: 'items',
      title: messages.editErrors.itemUpdateFailed,
      description,
    });

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

      if (refuseCount(snapshot.items.length + 1)) {
        return;
      }

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

      if (removed === null || refuseCount(snapshot.items.length - 1)) {
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

      if (refuseCount(snapshot.items.length + selected.size)) {
        return;
      }
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
      const selected = elementIndicesOf(snapshot, snapshot.selected);

      if (refuseCount(snapshot.items.length - selected.size)) {
        return;
      }

      commit(
        snapshot,
        removeArrayItems(snapshot.value, selected, kind),
        removeIds(snapshot.ids, snapshot.selected),
        new Set(),
      );
    },
  };

  // Built every render, outside the memo, because they close over
  // `onChange` and `onNodeChange` (#336). A cheap walk with no parsing.
  const items: DndItemsItem[] = rawItems.map(item =>
    toItemBindings(item, {
      id: identity.ids[item.index] ?? item.id,
      value,
      render,
      onNodeChange,
      onValueChange: next => updateValue(item.elementIndex, next),
      onPropertyChange: (key, next) =>
        updateProperty(item.elementIndex, key, next),
    }),
  );

  const expansion = useItemExpansion(items.map(item => item.id));

  return {
    kind,
    items,
    selection,
    expansion,
    actions,
    canEditStructure,
    canAddItems: (count = 1) =>
      maxItems === undefined || items.length + count <= maxItems,
    canRemoveItems: (count = 1) => items.length - count >= fewestItems,
    parseError,
  };
};
