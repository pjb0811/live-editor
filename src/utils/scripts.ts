import { CONFIG } from '../constants';
import { createBoundedCache } from './cache';
import { registerEditorCache } from './editor-caches';

// How many callers are between requesting a script and injecting it, per
// source. A blob URL evicted in that window can't be revoked yet: the caller
// already holds it and is about to hand it to a <script>, which then fails to
// load without any error (#443). The LRU still drops the entry on schedule;
// only the revocation waits, in `deferredRevocations`, until the last pin on
// that source is released.
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

// Resolves every script to a blob URL and hands them to `inject` while none of
// them can be revoked. `inject` has to consume them synchronously, which
// appending the <script> elements does: the browser resolves a blob URL when
// the element is inserted, so revoking it afterwards is safe.
//
// Needed because the URLs resolve at different times. A frame waiting on
// several scripts, or several frames loading at once, can push more distinct
// scripts through the cache than it holds before the last one arrives, and
// the LRU used to revoke the first URLs while they were still waiting to be
// injected (#443).
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
