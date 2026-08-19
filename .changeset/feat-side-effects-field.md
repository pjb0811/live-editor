---
'@jbpark/live-editor': patch
---

Declared `sideEffects` in `package.json` (scoped to CSS files) so bundlers can safely tree-shake unused exports from the package entry instead of conservatively retaining everything.
