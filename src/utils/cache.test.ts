import { describe, expect, it, vi } from 'vitest';

import { createBoundedCache } from './cache';

describe('createBoundedCache', () => {
  it('stores and retrieves values', () => {
    const cache = createBoundedCache<string, number>(3);

    cache.set('a', 1);

    expect(cache.has('a')).toBe(true);
    expect(cache.get('a')).toBe(1);
    expect(cache.size).toBe(1);
  });

  it('evicts the oldest entry once the limit is reached', () => {
    const cache = createBoundedCache<string, number>(2);

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.size).toBe(2);
  });

  it('calls onEvict with the evicted key and value', () => {
    const onEvict = vi.fn();
    const cache = createBoundedCache<string, number>(1, onEvict);

    cache.set('a', 1);
    cache.set('b', 2);

    expect(onEvict).toHaveBeenCalledExactlyOnceWith('a', 1);
  });

  it('deletes and clears entries', () => {
    const cache = createBoundedCache<string, number>(3);

    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.delete('a')).toBe(true);
    expect(cache.has('a')).toBe(false);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.has('b')).toBe(false);
  });
});
