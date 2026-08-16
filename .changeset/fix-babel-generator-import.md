---
'@jbpark/live-editor': patch
---

Fix the same `@babel/*` CJS/ESM interop bug (#145) in `@babel/generator`: `import generate from '@babel/generator'` resolved to the whole `{ default, generate, CodeGenerator }` exports object instead of the function under Vite's browser bundling. `extractAttributes()` silently swallowed the resulting `TypeError` into a `null` attribute value, so any JSX-expression-valued attribute (e.g. `data-binding={[...]}`) came back empty — selecting a section on the canvas showed no editable fields (or an error toast, when the failure surfaced elsewhere in the update path). Also moved `extract.ts`/`update.ts` off their own direct `@babel/traverse` imports to share `document.ts`'s already-fixed binding, instead of each carrying the same fix independently.
