export const STORAGE_KEY = 'live-editor-code';

export const CONFIG = {
  CACHE_LIMIT: 50,
  // The document parse cache. Its entries are whole Babel ASTs (about
  // 0.66 MB per document), and only the current and previous version get hits,
  // so it keeps few (#106).
  DOCUMENT_CACHE_LIMIT: 4,
  // The script cache (`utils/scripts.ts`). Its entries are live blob URLs,
  // revoked on eviction, and a preview loads only a few scripts (#104).
  SCRIPT_CACHE_LIMIT: 10,
} as const;

export const DATA_ATTR = {
  ID: 'data-id',
  BINDING: 'data-binding',
  // Names an entry of `Live.Dnd`'s `bindingKeys` instead of declaring the
  // bindings inline (#513).
  BINDING_KEY: 'data-binding-key',
  ITEM: 'data-item',
} as const;

// Attributes the editor owns. `data-id` links the canvas to the source,
// `data-name` is a section's name, and `data-binding` and `data-binding-key`
// declare what each edit is checked against. A binding can't target them,
// since rewriting one would break that link (#429).
export const RESERVED_BINDING_PROPERTIES: readonly string[] = [
  DATA_ATTR.ID,
  'data-name',
  DATA_ATTR.BINDING,
  DATA_ATTR.BINDING_KEY,
];

export const REGEX = {
  NUMBER: /^\d+(\.\d+)?$/,
  BOOLEAN_OR_NULL: /^(true|false|null|undefined)$/,
  MODULE_IMPORT_EXPORT_LINE:
    /^\s*(?:import|export)\b[^\n]*\bfrom\s+['"][^'"]*['"];?\s*$/gm,
} as const;

export const TS_PATTERNS = [
  /interface\s+\w+/,
  /type\s+\w+\s*=/,
  /:\s*\w+(\[\])?(\s*\||\s*&|\s*=|\s*;|\s*,|\s*\))/,
  /as\s+\w+/,
  /<[A-Z]\w*>/,
  /enum\s+\w+/,
  /public\s+|private\s+|protected\s+/,
  /readonly\s+/,
  /\?\s*:/,
] as const;

export const BINDING_PROP = {
  CHILDREN: 'children',
  INNER_TEXT: 'innerText',
  INNER_HTML: 'innerHTML',
  ITEMS: 'items',
} as const;

// The element whose `<section>` children are a document's sections, unless
// `Live.Dnd`'s `containerId` says otherwise (#449).
export const DEFAULT_CONTAINER_ID = 'app-container';

// A new, empty document built around `containerId`. `createDocument()` in
// `@jbpark/live-editor/utils` is the public way in; this is the template
// behind it and behind `DEFAULT_TEMPLATE`.
export const documentTemplate = (containerId: string) => `
import * as ui from 'ui-kit';
import { cn } from 'ui-kit/utils';

const App = () => {
  return (
    <main id="${containerId}"></main>
  )
}

export default App;
`;

export const DEFAULT_TEMPLATE = documentTemplate(DEFAULT_CONTAINER_ID);

export { PALETTE_SECTIONS } from './palette-sections';
