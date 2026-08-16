---
'@jbpark/live-editor': minor
---

Let a custom `renderPanel` build its own field controls. `PanelRenderData` now includes `bindings` — the selected section's editable `data-binding` fields flattened to one entry per bound property, each carrying its `type`, current `value`, `options` (when present), and an `onChange` wired straight into the same AST-update pipeline the built-in panel uses (including the error Toast on a bad edit). Consumers switch on `binding.type` to render their own `<input>` / `<textarea>` / `<select>` (or any control) instead of being handed a fixed field editor.

This replaces the earlier `fields` / `onFieldChange` / `FieldEditor` render-prop shape from the same unreleased cycle: rather than exposing the built-in `FieldEditor` component (and the raw `DataAttrNode[]` behind it), `renderPanel` now hands over plain, ready-to-render binding data, so a custom panel never has to touch `DataAttrNode` / `parseBinding` / `getCurrentValue` itself. The field-extraction logic still lives in `Dnd` (moved up out of `Panel`), so the built-in panel and a custom `renderPanel` share one implementation.
