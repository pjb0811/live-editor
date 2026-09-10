---
'@jbpark/live-editor': minor
---

Export the built-in single-binding control as `Live.Dnd.Field`. A custom `renderPanel` can now mix its own controls with the built-in one per binding, instead of choosing all-or-nothing between hand-rolling every field and wrapping `DefaultPanel`.

It's driven entirely by public render data — a `PanelBinding` out of `bindings` plus `onNodeChange` — and renders the control only, leaving the label to the caller. Most useful for `items`/`children`/`array` bindings, whose editors reach nested data-bound elements that `bindings` alone can't address.

Also exports the `FieldProps` and `PanelNodeChange` types. `PanelNodeChange` names the node-level commit callback's shape, which was previously spelled out inline everywhere it appeared.
