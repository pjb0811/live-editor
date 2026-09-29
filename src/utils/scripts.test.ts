import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CONFIG } from '../constants';
import {
  clearScriptCache,
  getCachedScriptBlob,
  withScriptBlobs,
} from './scripts';

// More distinct scripts than the cache holds, so resolving all of them
// evicts the first ones before the last arrives.
const SOURCES = Array.from(
  { length: CONFIG.SCRIPT_CACHE_LIMIT + 2 },
  (_, index) => `https://example.test/script-${index}.js`,
);

describe('withScriptBlobs (#443)', () => {
  let created = 0;
  let revoked: string[] = [];

  beforeEach(() => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ text: () => Promise.resolve('export default 1;') }),
    );
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => `blob:stub/${(created += 1)}`,
      revokeObjectURL: (url: string) => revoked.push(url),
    });

    clearScriptCache();
    created = 0;
    revoked = [];
  });

  afterEach(() => {
    clearScriptCache();
    vi.unstubAllGlobals();
  });

  // What IFrame used to do. Kept to show the window the pins close: the
  // first URLs are already revoked when the batch resolves.
  it('shows the race when resolving without pins', async () => {
    const blobUrls = await Promise.all(SOURCES.map(getCachedScriptBlob));

    expect(blobUrls.some(url => revoked.includes(url))).toBe(true);
  });

  it('hands every URL to `inject` before any of them is revoked', async () => {
    const use = vi.fn((blobUrls: string[]) => {
      expect(blobUrls).toHaveLength(SOURCES.length);
      expect(blobUrls.filter(url => revoked.includes(url))).toEqual([]);
    });

    await withScriptBlobs(SOURCES, use);

    expect(use).toHaveBeenCalledTimes(1);
  });

  it('revokes the evicted URLs once they are released', async () => {
    let handed: string[] = [];

    await withScriptBlobs(SOURCES, blobUrls => {
      handed = blobUrls;
    });

    // The cache kept the most recent entries and dropped the rest. The
    // dropped ones are revoked now, the kept ones are not.
    const evicted = handed.slice(0, SOURCES.length - CONFIG.SCRIPT_CACHE_LIMIT);
    const kept = handed.slice(SOURCES.length - CONFIG.SCRIPT_CACHE_LIMIT);

    expect(revoked).toEqual(evicted);
    expect(kept.filter(url => revoked.includes(url))).toEqual([]);
  });

  // One frame is still waiting on a slow script while other frames push
  // enough distinct scripts through to evict the URL it already holds.
  it('keeps a held URL until its caller is done with it', async () => {
    const SLOW = 'https://example.test/slow.js';
    let finishSlow!: () => void;

    vi.stubGlobal('fetch', (src: string) =>
      src === SLOW
        ? new Promise(resolve => {
            finishSlow = () =>
              resolve({ text: () => Promise.resolve('export default 1;') });
          })
        : Promise.resolve({ text: () => Promise.resolve('export default 1;') }),
    );

    let held: string[] = [];
    const waiting = withScriptBlobs([SOURCES[0]!, SLOW], blobUrls => {
      held = blobUrls;
      expect(revoked).not.toContain(blobUrls[0]);
    });

    const first = await getCachedScriptBlob(SOURCES[0]!);

    await Promise.all(SOURCES.slice(1).map(getCachedScriptBlob));

    // Evicted from the cache by now, but still held.
    expect(revoked).not.toContain(first);

    finishSlow();
    await waiting;

    expect(held[0]).toBe(first);
    expect(revoked).toContain(first);
  });

  it('releases its pins when a script fails to load', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ text: () => Promise.resolve('ok') })
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue({ text: () => Promise.resolve('ok') }),
    );

    const use = vi.fn();

    await expect(withScriptBlobs(SOURCES.slice(0, 2), use)).rejects.toThrow(
      'offline',
    );
    expect(use).not.toHaveBeenCalled();

    // Nothing is pinned any more, so evicting the first entry revokes it
    // straight away.
    await Promise.all(SOURCES.slice(2).map(getCachedScriptBlob));

    expect(revoked).toContain('blob:stub/1');
  });
});
