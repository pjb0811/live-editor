---
'@jbpark/live-editor': minor
---

Let a binding's `widget` carry that control's own configuration instead of
only naming it:

```js
{
  label: 'Content Spacing', property: 'size', type: 'number',
  min: 0, max: 40,
  widget: { type: 'slider', step: 4, unit: 'px' },
}
```

`step`/`unit` are typed fields on `widget`, and any further control-specific
keys pass through as before, so a custom panel reads them without narrowing
`unknown`. `min`/`max`/`pattern`/`required` stay on the item: they are value
constraints `validateBindingValue` enforces with or without a widget, so
moving them would make a range unexpressible for a plain number input and
give a slider a second, conflictable copy of its bounds.

Not a breaking change. The bare-string form (`widget: 'slider'`) still parses,
normalized to `{ type: 'slider' }`, so consumers only ever switch on
`widget.type`.

Also fixes a latent parse defect on the same field: a malformed `widget` used
to fail the item schema and drop the entire binding, so the field vanished
from the panel with no error. It now degrades to widget-less and keeps the
field, matching how an unrecognized `type` behaves.
