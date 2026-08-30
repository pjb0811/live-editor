---
'@jbpark/live-editor': minor
---

Export the built-in property panel as `Live.Dnd.DefaultPanel`, and `ICON_OPTIONS` alongside the existing `ICON_MAP`, so a custom `renderPanel` can wrap the built-in panel or reach icon-picker parity instead of rebuilding it from scratch (#237).

Step 3 of #235's roadmap: the built-in panel (`field.tsx`/`node.tsx`/`panel.tsx`) used to read `DataAttrNode`/`BindingItem` directly and re-derive the exact projection `dnd.tsx` already builds as `PanelBinding[]` for a custom `renderPanel` — two implementations of the same data, which is how earlier gaps between the built-in panel and the public API (#225, #234) went unnoticed. The built-in panel now consumes `PanelBinding` throughout, the same array a `renderPanel` receives, so a field missing from the public projection breaks the library's own panel immediately instead of silently limiting a consumer's.

- `Field` now takes a single `binding: PanelBinding` prop instead of separate `binding`/`id`/`value`/`onChange` props.
- `Panel` (now exported as `Live.Dnd.DefaultPanel`) takes `bindings: PanelBinding[]` instead of re-parsing `DataAttrNode[]` itself.
- `ICON_OPTIONS` (the label/value pairs the built-in icon-picker feeds its `<select>`) is now exported alongside `ICON_MAP`.

`Items`/`Children` (array and children-list editing) are unchanged and stay on their existing node-level internals — extending them to the public `PanelBinding` surface needs `PanelBinding.value` to stop being a plain string first, which is a separate, larger change (#238). `DefaultPanel` re-embedded outside of `Dnd` itself (e.g. wrapped in a custom `renderPanel`) renders correctly but won't commit edits made through those two, since the internal callback they need for it isn't part of the public data `renderPanel` receives — documented on `DefaultPanel`'s own props and in `website/docs/custom-palette-panel.mdx`.

No breaking change: `Field`/`Panel`'s prop shapes are internal, not previously exported, so this is additive from a consumer's perspective.
