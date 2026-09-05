---
'@jbpark/live-editor': patch
---

Report why an `update()` failed instead of collapsing every cause into one
`success: false`. `UpdateResult` now carries a structured `failure`
(`element-not-found`, `no-binding`, `binding-not-declared`,
`duplicate-binding`, `attribute-not-found`, `parse-error`), and `bulkUpdate`
returns per-entry `failures`. The panel's error toast now names the actual
problem — usually a wrong `property`/`label` in the element's `data-binding` —
and only says "check the console" on paths that actually log there.
