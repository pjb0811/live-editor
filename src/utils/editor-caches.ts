// Every editor-owned cache that lives for the whole page: the compilation
// cache, the script blob cache, and the AST parse caches. Each registers its
// own `clear` here when its module loads, so this module imports none of
// them. The provider only needs `registerEditorSession`, and importing the
// caches directly would pull `@babel/standalone` and Babel's AST packages
// into every bundle that mounts `Live`, whether or not it compiles or edits
// a document (#407). A cache whose module never loaded is empty anyway.
//
// Deliberately not exhaustive of every cache in the library: an instance
// from `createSectionPreviewCache` is owned by the component that holds it
// (`useState(() => createSectionPreviewCache())`), so it is already released
// with that component and there is nothing global to clear.
const editorCaches = new Set<() => void>();

export const registerEditorCache = (clear: () => void) => {
  editorCaches.add(clear);
};

export const clearEditorCaches = () => {
  editorCaches.forEach(clear => clear());
};

// These caches are shared across every editor session in the page, so they
// can only be released once the *last* one is gone. Clearing on any single
// unmount would reach into siblings that are still mounted — harmless when
// the only casualty was a compilation cache (a cache miss costs time, not
// correctness), but not once revoking blob URLs is part of it: a sibling
// could be handed a URL that is dead before its iframe loads it.
let activeEditorSessions = 0;

// Returns the release function rather than exposing the counter, so a caller
// cannot release a session it never acquired. Idempotent, so React calling
// an effect's cleanup twice cannot drive the count negative.
export const registerEditorSession = (): (() => void) => {
  activeEditorSessions += 1;

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    activeEditorSessions -= 1;

    if (activeEditorSessions === 0) {
      clearEditorCaches();
    }
  };
};
