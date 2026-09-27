import { CONFIG } from '../constants';
import { createBoundedCache } from './cache';
import { registerEditorCache } from './editor-caches';

const scriptCache = createBoundedCache<string, string>(
  CONFIG.SCRIPT_CACHE_LIMIT,
  (_src, blobUrl) => URL.revokeObjectURL(blobUrl),
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
    // Cleanup belongs on both paths, not just the successful one. A rejected
    // promise left in this map is adopted by every later caller, so a single
    // failed fetch made that script unloadable for the rest of the session
    // even after the network recovered.
    .finally(() => {
      loadingScriptCache.delete(src);
    });

  loadingScriptCache.set(src, promise);

  return promise;
};

export const preloadScripts = (scripts: string[]): void => {
  scripts.forEach(src => {
    // Fire-and-forget by design, so the rejection is absorbed here rather
    // than surfacing as an unhandled one. The retry now works (see above),
    // and the real load path reports the failure to whoever awaits it.
    getCachedScriptBlob(src).catch(() => {});
  });
};

// Blob URLs are browser resources, not just memory, so dropping the entries
// is not enough — they have to be revoked. `clear()` runs the same `onEvict`
// the LRU does, so the `URL.revokeObjectURL` above covers this path too.
//
// `loadingScriptCache` goes with it: a promise from a session that no longer
// exists should not be adopted by the next one, which would otherwise hand
// back a blob URL created before the revocation.
export const clearScriptCache = () => {
  scriptCache.clear();
  loadingScriptCache.clear();
};

registerEditorCache(clearScriptCache);
