---
'@jbpark/live-editor': minor
---

Show which element each panel field edits. When a section has more than one editable element, the built-in panel heads each element's fields with its tag name and text (for example `ui.Typography.Title` and "Fast setup"), so fields that share a label, as the binding registry and keys make common, can be told apart; a section with one editable element looks as before. Each group is also a labeled `role="group"`. Hovering over or focusing a field outlines its element on the canvas, nested Items and Children fields included. For custom panels, each `PanelBinding` carries `element: { tagName, text }`, and `useDndInspector()` has `highlight(id)` to draw the same outline.
