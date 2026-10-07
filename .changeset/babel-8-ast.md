---
'@jbpark/live-editor': patch
---

Update the Babel packages bundled for AST editing (`@babel/parser`, `@babel/types`, `@babel/traverse`, `@babel/generator`) to Babel 8. Edits produce the same source as before. The runtime compiler, `@babel/standalone`, stays on Babel 7, so the supported Node range doesn't change.
