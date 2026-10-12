import { useSet } from '@jbpark/use-hooks';

import type { DndItemsExpansion } from './use-dnd-items';

// Which of `ids` are expanded. It holds the collapsed ids rather than the
// expanded ones, so an id it hasn't seen yet, such as a just-added item's,
// starts expanded. Ids are never reused, so one left behind by a removed
// item can't collapse another.
export const useItemExpansion = (ids: string[]): DndItemsExpansion => {
  const [collapsed, { toggle, set }] = useSet<string>();

  return {
    expandedIds: ids.filter(id => !collapsed.has(id)),
    isExpanded: id => !collapsed.has(id),
    toggle: id => toggle(id),
    setExpanded: expandedIds => {
      const expanded = new Set(expandedIds);

      set(ids.filter(id => !expanded.has(id)));
    },
  };
};
