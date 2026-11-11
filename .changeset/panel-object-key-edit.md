---
'@jbpark/live-editor': patch
---

Keep an object binding's source as written when the panel edits one key

Editing one key of an object binding, such as `color` in `style={{ color: 'red', fontSize: 12 }}`, rewrote the whole object: keys were quoted and the value was printed over several lines. The built-in panel now replaces only that key's value in the source, so the edit gives `style={{ color: 'blue', fontSize: 12 }}`. A key of a nested object is edited the same way. When the source can't be edited in place, the panel commits the whole object as before.
