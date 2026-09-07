---
'@jbpark/live-editor': minor
---

Make `prettier` an optional peer dependency. Only the `editor` subpath uses it
(for format-on-save), so consumers who don't need formatting no longer install
~9.6 MB. `useFormatCode` now loads prettier lazily and, when it's absent,
returns the code unformatted instead of throwing. Install `prettier` (>=3)
alongside `@jbpark/live-editor` to keep format-on-save.
