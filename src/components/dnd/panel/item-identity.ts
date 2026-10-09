// Which kind of array item the panel is editing.
type ItemKind = 'object' | 'primitive';

// What identity needs of an item: its generated `id` and its source text.
interface IdentifiedItem {
  id: string;
  source: string;
}

// The ids that follow each item through edits, so a row keeps its identity
// (and its expanded state) after a move or delete. `signatures` is the source
// of each item when the ids were last assigned.
export interface ItemIdentityState {
  value: string;
  kind: ItemKind;
  ids: string[];
  signatures: string[];
}

export const createIdentityState = (
  value: string,
  kind: ItemKind,
  items: IdentifiedItem[],
  ids: string[] = items.map(item => item.id),
): ItemIdentityState => ({
  value,
  kind,
  ids,
  signatures: items.map(item => item.source),
});

export const reconcileIdentityState = (
  current: ItemIdentityState | null,
  value: string,
  kind: ItemKind,
  items: IdentifiedItem[],
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

export const moveId = (ids: string[], from: number, to: number) => {
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);

  return next;
};

export const removeIds = (ids: string[], indices: Set<number>) => {
  return ids.filter((_, index) => !indices.has(index));
};
