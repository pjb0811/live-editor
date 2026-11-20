---
'@jbpark/live-editor': minor
---

Add `Live.Dnd`'s `documentBindings`, which makes a document's top-level settings object editable from the panel: each key names a `const` holding an object literal, such as `const settings = { theme: 'dark' }`, and its bindings name that object's keys. The built-in panel shows them while no section is selected, a custom panel reads them with the new `useDndDocument()`, and an edit replaces only that key's value. A refused edit is reported through `onEditError` as a new `document` error. `LiveMessages` gains `panel.documentSettings` and three `editErrors` keys.
