---
'@jbpark/live-editor': minor
---

Split compiling into two steps, so a page that only shows saved documents doesn't need Babel. `transpile(code)` from `@jbpark/live-editor/utils` returns the document as plain JavaScript (or Babel's error), to store when the document is saved, and `runModule(js, modules)` from the new `@jbpark/live-editor/runtime` entry runs it without a compiler (0.3 KB gzip, against about 560 KB for `compile`). `compile()` is the two in one, with its cache unchanged.
