export interface BoundedCache<K, V> {
  has: (key: K) => boolean;
  get: (key: K) => V | undefined;
  set: (key: K, value: V) => void;
  delete: (key: K) => boolean;
  clear: () => void;
  readonly size: number;
}

// Fixed-capacity LRU cache shared by compile()/getCachedScriptBlob()/
// extract() — evicts the *least recently used* entry once `limit` is
// reached. Relies on Map's insertion-order iteration: the first key is
// always the least recently touched, because both get() (on a hit) and
// set() (when overwriting an existing key) delete-then-reinsert the entry
// to move it to the end. `onEvict` lets callers release resources tied to
// an evicted value (e.g. revoking a blob URL).
export const createBoundedCache = <K, V>(
  limit: number,
  onEvict?: (key: K, value: V) => void,
): BoundedCache<K, V> => {
  const store = new Map<K, V>();

  const get = (key: K): V | undefined => {
    if (!store.has(key)) {
      return undefined;
    }

    const value = store.get(key)!;

    store.delete(key);
    store.set(key, value);

    return value;
  };

  const set = (key: K, value: V) => {
    if (store.has(key)) {
      const oldValue = store.get(key)!;

      store.delete(key);
      onEvict?.(key, oldValue);
    } else if (store.size >= limit) {
      const oldestKey = store.keys().next().value;

      if (oldestKey !== undefined) {
        const oldestValue = store.get(oldestKey)!;

        store.delete(oldestKey);
        onEvict?.(oldestKey, oldestValue);
      }
    }

    store.set(key, value);
  };

  const deleteKey = (key: K): boolean => {
    if (!store.has(key)) {
      return false;
    }

    const value = store.get(key)!;

    store.delete(key);
    onEvict?.(key, value);

    return true;
  };

  const clear = () => {
    for (const [key, value] of store) {
      onEvict?.(key, value);
    }

    store.clear();
  };

  return {
    has: key => store.has(key),
    get,
    set,
    delete: deleteKey,
    clear,
    get size() {
      return store.size;
    },
  };
};
