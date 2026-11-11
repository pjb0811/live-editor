---
'@jbpark/live-editor': patch
---

Drop the `zod` dependency

`zod` was used by one file, for the checks that read a `data-binding` declaration's fields. Those are now plain checks that accept and drop the same values, so `zod` is no longer installed with the package. A consumer bundle of `@jbpark/live-editor/utils/ast` shrinks from 194.3 KB to 177.7 KB gzip.
