---
'@jbpark/live-editor': minor
---

Rename the two structural editing hooks to match the rest of the `useDnd*` family: `useItemsEditor` is now `useDndItems` and `useChildrenEditor` is now `useDndChildren`. Their types follow the same rule: `ItemsEditor*` is now `DndItems*` (for example `ItemsEditorItem` → `DndItemsItem`), and `ChildrenEditor*` is now `DndChildren*`. The old names are still exported from `@jbpark/live-editor/dnd`, and the three item types from the package root, as deprecated aliases of the new ones, so existing code keeps compiling and behaves the same. They will be removed in the next major.
