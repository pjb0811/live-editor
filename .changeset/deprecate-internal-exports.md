---
'@jbpark/live-editor': minor
---

Add `checkDocument(code, options?)` to `@jbpark/live-editor/utils`. It tells a host whether `Live.Dnd` can edit a document before saving or loading it, with the same reasons `onEditError` reports: `{ ok: true }`, or `{ ok: false, reason: 'parse-error' | 'container-not-found', ... }`.

Deprecate the internal helpers exported from `./utils` and `./utils/ast`, such as the array-literal editing functions behind `useDndItems`, the binding resolution behind `extract`, and the document layer under `extractSections` and `replaceSections`. They keep working and leave those entries in the next major. The new Utilities page lists each one with what to use instead.
