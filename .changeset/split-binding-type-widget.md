---
'@jbpark/live-editor': minor
---

Split the binding `type` axis into `type` (data kind) + `widget` (presentation) so a custom `renderPanel` can declare its own controls (#234, #236).

`BindingItem`/`PanelBinding` gained a `widget?: string` field, separate from
`type`. `type` stays a closed enum describing what a value _is_ — the
library's own validation/coercion has to be able to switch on it
exhaustively. `widget` is deliberately just a `string`, not an enum: it
describes how to _render_ the value, and the library can't enumerate
controls it doesn't implement. A consumer's `renderPanel` now owns
presentation outright by declaring and switching on any `widget` value it
wants (e.g. `widget: 'slider'`), instead of losing that metadata to
`parseBinding`'s zod schema the way a custom `type` string used to (#234).

`icon-picker`/`asset-picker` — previously the only two `BindingType` values
that actually described a control rather than a data kind — are kept as
deprecated aliases for backward compatibility. Existing content authored as
`data-binding={[{ type: 'icon-picker', ... }]}` keeps parsing unchanged;
`parseBinding` now normalizes it into `{ type: 'string', widget: 'icon-picker' }`
rather than passing `icon-picker` through as `type` directly. The built-in
panel's icon set is now exported as `ICON_MAP` so a custom `renderPanel` can
reuse it instead of reimplementing an icon library.

No breaking change: `widget` is additive, and every previously-valid
`data-binding` literal still produces the same effective behavior.
