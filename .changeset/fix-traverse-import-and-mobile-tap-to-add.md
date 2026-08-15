---
'@jbpark/live-editor': patch
---

Fix a broken `@babel/traverse` import that made `parseDocument` throw on every call in the browser (`TypeError: traverse is not a function`), silently breaking drag-and-drop entirely — nothing could ever be added to the canvas. `@babel/traverse`'s CJS build re-exports itself as `{ default: traverse, ...rest }`, and Vite's dependency pre-bundling doesn't unwrap that inner `default` a second time when re-exporting for ESM, so the plain `import traverse from '@babel/traverse'` resolved to the whole exports object instead of the function. Vitest's Node-based module resolution didn't hit this, so it went undetected by the test suite despite being broken in every real browser build, dev and production alike.

Also added a `tapToAdd` mode to the built-in drag palette (and a matching `isMobile` field on `PaletteRenderData` for custom `renderPalette` implementations): the mobile palette Drawer now adds a component on a single tap instead of requiring a double-tap. Double-click-to-add stays desktop-only, where it exists specifically to distinguish a deliberate add from an aborted drag attempt — a distinction that doesn't apply inside the Drawer, since there's nothing to drag onto there.
