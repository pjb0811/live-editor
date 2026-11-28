---
'@jbpark/live-editor': patch
---

Copying a section in `Live.Dnd` now renews only real element ids. Before, it rewrote `data-id="…"` wherever it appeared in the section, including text in string literals and attribute values, which changed what the copy rendered, and it kept single-quoted ids such as `data-id='note'`, so the copy shared them with the original. Now every string-literal `data-id` gets a new value in its own quotes, unused anywhere in the document, and the rest of the section is copied as written. An expression id such as ``data-id={`img-${index}`}`` stays as written.
