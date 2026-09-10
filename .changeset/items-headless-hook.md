---
'@jbpark/live-editor': minor
---

Export `useItemsEditor`, the array-editing engine behind the built-in Items panel, so a custom panel can keep its own markup instead of adopting the built-in control. It returns `PanelBinding`s and position-translated actions, so it composes with `Live.Dnd.Field`: render your own layout and hand individual bindings to the built-in control where that's enough.

It saves reimplementing the parts that are easy to get wrong — re-parsing each item's JSX to find nested data-bound elements, resolving the binding `render` map, translating visible item positions to array element positions before every edit, and reconciling the selection after a move or delete.

Also exports the `ItemsEditor`, `ItemsEditorItem`, `ItemsEditorNestedGroup`, `ItemsEditorNestedElement`, `ItemsEditorActions` and `ItemsEditorOptions` types.

Internally `panel/items.tsx` is now presentation over that hook (668 → 291 lines). The built-in panel's rendered markup is unchanged.
