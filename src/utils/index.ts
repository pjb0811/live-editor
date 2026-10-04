// The public `./utils` entry. Each concern lives in its own module so that
// library code imports only what it uses: `Live.Preview` needs `compile`,
// not the AST layer behind the section helpers, and the provider needs
// neither (#407). Import from those modules inside the library, not here.
import { transformCode as _transformCode } from './compile';
import { detectTypeScript as _detectTypeScript } from './detect-typescript';
import { registerEditorSession as _registerEditorSession } from './editor-caches';
import { getCachedScriptBlob as _getCachedScriptBlob } from './scripts';
import { clearScriptCache as _clearScriptCache } from './scripts';
import { generateSection as _generateSection } from './sections';
import { generateSections as _generateSections } from './sections';
import { createSectionPreviewCache as _createSectionPreviewCache } from './sections';
import type { SectionPreviewCache as _SectionPreviewCache } from './sections';

export { cn } from './cn';
export { clearCompilationCache, compile } from './compile';
export { clearEditorCaches } from './editor-caches';
export { preloadScripts } from './scripts';
export {
  checkDocument,
  createDocument,
  extractSections,
  replaceSections,
} from './sections';
export type {
  DocumentCheck,
  DocumentOptions,
  DocumentProblem,
  SectionOptions,
} from './sections';

// Internal helpers this entry used to export. Each still works, and leaves
// the entry in the next major (#522). Re-exports only: a declaration here,
// such as `export const x = _x`, moves the entry's types into the shared
// declaration chunk that also pulls in React.
/** @deprecated Internal. Use `compile`. Removed in the next major. */
export const transformCode = _transformCode;
/** @deprecated Internal. Removed in the next major. */
export const detectTypeScript = _detectTypeScript;
/** @deprecated Internal. `Live` registers its own session. Removed in the next major. */
export const registerEditorSession = _registerEditorSession;
/** @deprecated Internal. Use `preloadScripts`. Removed in the next major. */
export const getCachedScriptBlob = _getCachedScriptBlob;
/** @deprecated Internal. Use `clearEditorCaches`. Removed in the next major. */
export const clearScriptCache = _clearScriptCache;
/** @deprecated Internal. `Live.Dnd` renders section previews itself. Removed in the next major. */
export const generateSection = _generateSection;
/** @deprecated Internal. `Live.Dnd` renders section previews itself. Removed in the next major. */
export const generateSections = _generateSections;
/** @deprecated Internal. `Live.Dnd` renders section previews itself. Removed in the next major. */
export const createSectionPreviewCache = _createSectionPreviewCache;
/** @deprecated Internal. Removed in the next major. */
export type SectionPreviewCache = _SectionPreviewCache;
