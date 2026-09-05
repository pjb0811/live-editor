---
'@jbpark/live-editor': patch
---

Fix panel text/number/date/url/asset inputs ignoring external value changes

The panel's text-like inputs were uncontrolled (`defaultValue`), so once mounted
they ignored later changes to their incoming value. When the source changed under
a still-selected element — an undo/redo, or another field touching the same binding
— the input kept showing the pre-change text, and blurring re-committed that stale
text back into the source, clobbering the undo. The url/asset/number/textarea inputs
now hold local live state with a render-phase reset when the canonical value changes
(the pattern `ColorPickerField` already used), and the date picker binds the value
directly, so the displayed value always tracks the source of truth.
