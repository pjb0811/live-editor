// The page-wide caches the editor owns: compiled modules, script blobs and
// the AST parse caches. Each registers its own `clear` here when its module
// loads, so this module imports none of them, and the provider doesn't pull
// Babel into every bundle that mounts `Live` (#407). A section preview cache
// belongs to its component and isn't listed here.
const editorCaches = new Set<() => void>();

export const registerEditorCache = (clear: () => void) => {
  editorCaches.add(clear);
};

export const clearEditorCaches = () => {
  editorCaches.forEach(clear => clear());
};

// Shared by every editor on the page, so they're cleared only when the last
// one unmounts. Clearing earlier could revoke a blob URL another editor is
// about to load.
let activeEditorSessions = 0;

// Returns the release function, so a caller can only release what it
// acquired. Calling it twice is harmless, as React may in development.
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
