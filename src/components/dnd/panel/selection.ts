import { useMemo, useState } from 'react';

export const removeIndices = <T>(items: T[], indices: Set<number>): T[] => {
  return items.filter((_, index) => !indices.has(index));
};

/**
 * Shifts every selected index up/down by one step as a block, preserving
 * relative order — scattered selections stop moving individually once they
 * hit an unselected neighbor, so the whole group slides together instead of
 * items passing through each other.
 */
export const moveSelectedIndices = <T>(
  items: T[],
  indices: Set<number>,
  direction: 'up' | 'down',
): { items: T[]; indices: Set<number> } => {
  const next = [...items];
  const nextIndices = new Set(indices);

  const ordered = [...indices].sort((a, b) =>
    direction === 'up' ? a - b : b - a,
  );

  for (const index of ordered) {
    const target = direction === 'up' ? index - 1 : index + 1;

    if (target < 0 || target >= next.length || nextIndices.has(target)) {
      continue;
    }

    [next[index], next[target]] = [next[target]!, next[index]!];
    nextIndices.delete(index);
    nextIndices.add(target);
  }

  return { items: next, indices: nextIndices };
};

export const useMultiSelect = (count: number) => {
  const [rawSelected, setSelected] = useState<Set<number>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);

  // Indices can outlive the item they pointed to (e.g. after a delete
  // shrinks the list) — clamp against the current count on every render
  // instead of syncing state back via an effect.
  const selected = useMemo(() => {
    const next = new Set([...rawSelected].filter(index => index < count));
    return next.size === rawSelected.size ? rawSelected : next;
  }, [rawSelected, count]);

  const toggle = (index: number, shiftKey = false) => {
    setSelected(prev => {
      const next = new Set(prev);

      if (shiftKey && anchor !== null) {
        const [start, end] = anchor < index ? [anchor, index] : [index, anchor];

        for (let i = start; i <= end; i++) {
          next.add(i);
        }
        return next;
      }

      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
    setAnchor(index);
  };

  const clear = () => {
    setSelected(new Set());
    setAnchor(null);
  };

  const replace = (indices: Set<number>) => {
    setSelected(indices);
  };

  return {
    selected,
    isSelected: (index: number) => selected.has(index),
    toggle,
    clear,
    replace,
  };
};
