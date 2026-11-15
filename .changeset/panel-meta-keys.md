---
'@jbpark/live-editor': minor
---

The built-in panel now reads three of the documented `meta` keys. `description` shows under a field's label and describes its control for screen readers. `group` boxes an element's fields with the same name under that name. `visible` leaves out a field whose rule is `false` or doesn't match, and an element whose fields are all hidden. Documents that already set these keys look different in the built-in panel; `renderField` and custom panels are unchanged. The rule check is exported from `@jbpark/live-editor/dnd` as `isBindingVisible`, with the `VisibleRule` type. The default palettes' Hero group is renamed from `layout` to `Layout`, since the name is now shown.
