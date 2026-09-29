---
'@jbpark/live-editor': patch
---

Let a `<section>` carry its own `data-binding`. The panel used to drop the section's root element from its fields, so a binding written on the section itself (for a background, padding or spacing) was silently ignored. It now shows up like any other element's, ahead of the elements inside the section. Sections without a `data-binding`, which includes every default palette section, behave as before.

The editor's own attributes, `data-id`, `data-name` and `data-binding`, can't be the target of a binding. A field on one of them is read-only (`canEditValue: false`), and `update()` refuses it with a new `'reserved-property'` failure, which the panel reports through `onEditError`.
