import { CONFIG } from '../constants';
import { createBoundedCache } from './cache';
import { registerEditorCache } from './editor-caches';

// How many callers have requested each script and not yet injected it. A
// blob URL evicted in that time isn't revoked until the last of them is done
// (`deferredRevocations`), or its `<script>` would fail to load without an
// error (#443).
const pins = new Map<string, number>();
const deferredRevocations = new Map<string, string[]>();

const revoke = (src: string, blobUrl: string) => {
  if (!pins.has(src)) {
    URL.revokeObjectURL(blobUrl);
    return;
  }

  deferredRevocations.set(src, [
    ...(deferredRevocations.get(src) ?? []),
    blobUrl,
  ]);
};

const pin = (src: string) => {
  pins.set(src, (pins.get(src) ?? 0) + 1);
};

const unpin = (src: string) => {
  const count = (pins.get(src) ?? 0) - 1;

  if (count > 0) {
    pins.set(src, count);
    return;
  }

  pins.delete(src);
  deferredRevocations.get(src)?.forEach(blobUrl => {
    URL.revokeObjectURL(blobUrl);
  });
  deferredRevocations.delete(src);
};

const scriptCache = createBoundedCache<string, string>(
  CONFIG.SCRIPT_CACHE_LIMIT,
  revoke,
);
const loadingScriptCache = new Map<string, Promise<string>>();

export const getCachedScriptBlob = async (src: string): Promise<string> => {
  const cached = scriptCache.get(src);

  if (cached) {
    return cached;
  }

  const existing = loadingScriptCache.get(src);

  if (existing) {
    return existing;
  }

  const promise = fetch(src)
    .then(res => res.text())
    .then(text => {
      const blob = new Blob([text], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);

      scriptCache.set(src, blobUrl);

      return blobUrl;
    })
    // Clean up after a failure too: a rejected promise left here would be
    // reused by every later caller, so the script could never load again.
    .finally(() => {
      loadingScriptCache.delete(src);
    });

  loadingScriptCache.set(src, promise);

  return promise;
};

// Resolves every script to a blob URL and hands them to `inject` while none
// of them can be revoked. `inject` must use them at once, as appending
// `<script>` elements does: the browser resolves a blob URL on insertion.
// Several scripts, or several frames, can push more scripts through the cache
// than it holds before the last one arrives (#443).
export const withScriptBlobs = async (
  scripts: string[],
  inject: (blobUrls: string[]) => void,
): Promise<void> => {
  scripts.forEach(pin);

  try {
    inject(await Promise.all(scripts.map(getCachedScriptBlob)));
  } finally {
    scripts.forEach(unpin);
  }
};

export const preloadScripts = (scripts: string[]): void => {
  scripts.forEach(src => {
    // Not awaited, so the rejection is handled here. The real load reports a
    // failure to whoever awaits it.
    getCachedScriptBlob(src).catch(() => {});
  });
};

// Revokes every blob URL, through the same `onEvict` the LRU uses, and drops
// the pending loads, so the next session doesn't get a URL created before
// the revocation.
export const clearScriptCache = () => {
  scriptCache.clear();
  loadingScriptCache.clear();
};

registerEditorCache(clearScriptCache);
