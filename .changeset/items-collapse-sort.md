---
'@jbpark/live-editor': minor
---

Collapse items and reorder them by dragging in the Items editor.

- Each item in the built-in Items editor can collapse to its header, and "Collapse all" / "Expand all" sits above the list.
- Items reorder by dragging their handle. A mouse drag starts after a few pixels, a touch drag after a long press, and the keyboard picks an item up with Space or Enter. The drop commits through `actions.move`, the same edit the up/down buttons make. The up/down buttons and bulk actions are unchanged.
- `useDndItems()` returns `expansion` (`expandedIds`, `isExpanded`, `toggle`, `setExpanded`) for custom panels. It's keyed by item `id`, so an item stays collapsed when it moves or a sibling changes, and every item, including one added later, starts expanded.
