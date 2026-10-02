---
'@jbpark/live-editor': minor
---

Pick an element in the canvas preview to edit its fields.

- A crosshair button at the bottom-left of the canvas turns on an element picker. The element under the pointer is outlined, and a click selects its section and brings its fields into view in the built-in panel, including fields nested in an Items or Children editor. Escape cancels, and sections can't be dragged while the picker is on.
- `onNodePick` on `Live.Dnd` reports each pick as `{ id, sectionId }`, where `id` is the element's `data-id`, the key its fields carry in `useDndPanel().bindings`.
- `useDndInspector()` returns `active`, `activate`, `deactivate`, `toggle` and `picked`, for a custom layout or panel. The `DndInspector` and `DndNodePick` types are exported.
- It works in every frame mode: iframe, shadow root, or rendered in place.
