---
'@jbpark/live-editor': minor
---

Add `Dnd.FieldEditor` (exported alongside `Dnd.DraggableItem`) so a custom `renderPanel` can render a selected section's editable `data-binding` fields — color pickers, rich text, selects, and everything else `Field` already handles — without reimplementing that logic. `PanelRenderData` now includes `fields` (the section's extracted, ready-to-render binding nodes), `onFieldChange` (commits an edit through the same AST-update pipeline the built-in panel uses, including the error Toast on a bad edit), and `FieldEditor` itself. The `dnd-custom-render` docs demo now uses these instead of a placeholder message, so the "Custom Palette & Panel" page's panel is actually functional.

This also moves the field-extraction logic (previously computed inside `Panel`) up into `Dnd`, so the built-in panel and a custom `renderPanel` share one implementation instead of the custom path needing its own copy.
