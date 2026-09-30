---
'@jbpark/live-editor': minor
---

Commit several panel edits as one change. `useDndPanel()` returns `onNodesChange`, which takes an array of the same `{ id, label, property, value }` edits `onNodeChange` takes. They apply in array order, all or none: if any edit is refused nothing is committed, and `onEditError` (or the toast) reports the first one that failed. On success `Live.Dnd`'s `onChange` is called once. Before, a control that writes more than one binding had to call `onChange` on each, which reached the host as separate changes and left the earlier ones applied when a later one failed.

- New `updateAll(code, entries)` in `@jbpark/live-editor/utils/ast` does the same on a source string. It returns `{ success: true, code }`, or `{ success: false, code, failure, index }` with the source untouched. New types: `UpdateEntry` and `UpdateAllResult` there, and `PanelNodesChange` from the dnd entry and the package root.
- `bulkUpdate` is deprecated and will be removed in the next major. It applies the entries that succeed even when another fails, so it can't back a single commit. Its behavior is unchanged.
- `onNodeChange` behaves as before. It now runs through the same path as a batch of one.
