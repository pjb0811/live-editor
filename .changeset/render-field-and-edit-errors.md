---
'@jbpark/live-editor': minor
---

Add two `Live.Dnd` props for customizing the built-in panel without replacing
it.

- `renderField(props, builtin)` is called before the built-in control for
  every field: top-level bindings, keys inside an `object` value, array item
  properties, and `Live.Dnd.Field` in a custom panel. Return a node to replace
  the control, `null` to render nothing, or `undefined` to keep `builtin`.
  Switch on `binding.widget?.type`, `binding.type` or anything else on the
  binding.
- `onEditError(error)` receives every edit the editor could not apply — a
  rejected field update, a section or `items` value that fails to parse, or
  a refused array edit — instead of the built-in toast. The payload carries
  the toast's `title` and `description`, plus `failure.reason` for updates.

Both are exported as types: `DndRenderField` and `DndEditError`.
