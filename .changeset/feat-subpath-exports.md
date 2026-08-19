---
'@jbpark/live-editor': minor
---

Added per-component subpath exports — `@jbpark/live-editor/dnd`, `/editor`, `/preview`, `/provider`, and `/error` — so a consumer who only needs one feature area doesn't have to bundle every other one. The root `@jbpark/live-editor` import is unchanged.
