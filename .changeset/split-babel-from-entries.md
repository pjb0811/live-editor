---
'@jbpark/live-editor': patch
---

Stop loading Babel where it isn't needed. `Live.Editor`, `Live.Error` and the `Live` provider no longer bundle `@babel/standalone` or Babel's AST packages, and `Live.Preview` no longer bundles the AST packages, which only the drag-and-drop editor and `./utils/ast` use. Measured in a minified consumer build: a provider plus `Live.Editor` drops from 1,151 KB to 190 KB gzipped, and a provider plus `Live.Preview` from 1,354 KB to 1,074 KB. The full editor and `./utils/ast` are unchanged, and so is every export of `./utils`.
