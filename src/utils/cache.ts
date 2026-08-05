export interface BoundedCache<K, V> {
  has: (key: K) => boolean;
  get: (key: K) => V | undefined;
  set: (key: K, value: V) => void;
  delete: (key: K) => boolean;
  clear: () => void;
  readonly size: number;
}

// Fixed-capacity cache shared by compile()/getCachedScriptBlob()/extract() —
// each evicts the oldest entry once `limit` is reached, relying on Map's
// insertion-order iteration to find it. `onEvict` lets callers release
// resources tied to an evicted value (e.g. revoking a blob URL).
export const createBoundedCache = <K, V>(
  limit: number,
  onEvict?: (key: K, value: V) => void,
): BoundedCache<K, V> => {
  const store = new Map<K, V>();

  const set = (key: K, value: V) => {
    if (store.size >= limit) {
      const oldestKey = store.keys().next().value;

      if (oldestKey !== undefined) {
        const oldestValue = store.get(oldestKey)!;

        store.delete(oldestKey);
        onEvict?.(oldestKey, oldestValue);
      }
    }

    store.set(key, value);
  };

  return {
    has: key => store.has(key),
    get: key => store.get(key),
    set,
    delete: key => store.delete(key),
    clear: () => store.clear(),
    get size() {
      return store.size;
    },
  };
};
