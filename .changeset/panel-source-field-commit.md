---
'@jbpark/live-editor': patch
---

Save the panel's source editor on blur, and refuse markup that would stop the section parsing

The built-in panel's editor for an `innerHTML` or `type: 'jsx'` binding saved only on Cmd/Ctrl+S, with nothing on screen saying so. It now also saves when focus leaves it, like the other fields. Cmd/Ctrl+S still saves, and still formats a `jsx` value.

Its value also went into the document unchecked. A value such as `a > b`, `<b>unclosed` or an emptied `jsx` field left the document unparseable, and `Live.Dnd` then refused every later edit. A panel edit whose result doesn't parse is now refused: the document stays as it was, and the error goes to `onEditError` (or the toast) as an `update` error with a `parse-error` failure. `update()` itself is unchanged.
