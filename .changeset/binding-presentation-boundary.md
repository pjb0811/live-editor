---
'@jbpark/live-editor': major
---

Draw the line between what the library owns and what a panel owns: the
library describes a value's data kind (`type`) and its constraints
(`min`/`max`/`pattern`/`required`); choosing and drawing a control is the
consumer's. `widget` is passed through untouched and the built-in panel no
longer reads it.

**Breaking**

- The built-in `icon-picker` and `asset-picker` controls are removed, along
  with the `ICON_MAP`/`ICON_OPTIONS` exports. A binding declaring either
  widget now gets the built-in default control for its `type`. Render your
  own control in a custom panel by switching on `binding.widget.type`.
- `icon-picker`/`asset-picker` are no longer `BindingType` values. An
  authored `type: 'icon-picker'` is treated like any unrecognized type: the
  field is kept, untyped. Author `type: 'string', widget: 'icon-picker'`
  instead.
- A render-map leaf's `PanelBinding.property` is now the object key when the
  leaf declares no `property`. It used to be the leaf's `type` name, or
  `undefined` when that type was unrecognized.

**Render-map leaves are full fields**

A nested `render` leaf now accepts every field a top-level binding does —
`label`, `widget`, `options`, `min`, `max`, `pattern`, `required`, and
consumer-defined keys under `meta` — and they reach the panel. Nested item
fields are validated the same way flat fields are; a leaf's `required` or
`min` used to be silently dropped. The leaf path now goes through the same
field conversion as every other panel path, and the items editor's
`meta.valueType` is merged into the leaf's own `meta` instead of replacing it.

**More forgiving parsing**

A malformed `min`, `max`, `pattern` or `required` now degrades just that
field, as `type`, `widget` and `options` already did, instead of dropping the
whole binding.
