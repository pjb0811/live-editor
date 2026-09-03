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
