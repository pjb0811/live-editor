---
'@jbpark/live-editor': patch
---

Fix "process is not defined" crash when importing the published package in browsers

`@babel/types` (bundled into the `document-*` chunk shared by the root entry and
`@jbpark/live-editor/utils/ast`) reads `process.env.BABEL_TYPES_8_BREAKING` with
bare, unguarded reads at module-init time. `process` doesn't exist in browsers,
so any consumer whose bundler doesn't define it crashed on import with
`ReferenceError: process is not defined`. `tsdown` now substitutes
`process.env.BABEL_TYPES_8_BREAKING` (`false`) and `process.env.NODE_ENV`
(`"production"`) at build time, so `dist` is self-contained and no consumer-side
`process` shim is needed. Behaviour is unchanged (the flag was already falsy),
and the dead branches tree-shake away.
