---
'@jbpark/live-editor': minor
---

The Items editor edits functions in array items as source, as `type: 'function'` does for attributes. A property declared `type: 'function'` in `render`, or an untyped one holding a function expression, gets the code editor (or a select with `options`). So does an item that is itself a function expression. A value that isn't a function or a reference to one is refused with the function error.
