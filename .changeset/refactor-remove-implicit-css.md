---
'@jbpark/live-editor': patch
---

`@jbpark/ui-kit`'s stylesheet is now pulled in via `@import` at the CSS level (bundled into `dist/style.css`) instead of a JS-side `import '@jbpark/ui-kit/style.css'` that survived unresolved into `dist/index.js`. Consumers following the documented `import '@jbpark/live-editor/style.css'` see no change; consumers whose toolchain couldn't handle a raw CSS import out of `node_modules` (plain Node, non-CSS-aware bundlers) can now import the JS entry without that failing.
