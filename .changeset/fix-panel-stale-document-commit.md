---
'@jbpark/live-editor': patch
---

Fix a panel edit reverting a newer change made to another section.

While a section was selected, any change to the rest of the document that left the selected section's own source untouched was silently rolled back by the next edit committed from the panel. Editing a sibling section, moving or deleting one, undoing, or swapping the `onChange` prop all produced this: the panel's commit rebuilt the document from the snapshot it had been holding since the selection was made, so the newer text was overwritten with the old.

The cause was one `useMemo` doing two jobs. `bindings` was keyed on the parsed fields alone, and those are derived from the selected section's source — so an edit elsewhere left the key identical, the memo was reused, and every `onChange` it held stayed bound to the previous document.

Parsing and callback binding are now separate: the parse is still memoized per section source, while the callbacks are rebound each render, the same split `useItemsEditor` already uses. Every commit therefore reads the current document.

`PanelBinding` is unchanged in shape, and this applies to the built-in panel, a wrapped `Live.Dnd.Panel`, and custom markup over `useDndPanel()` alike. The array `useDndPanel().bindings` returns is no longer referentially stable across renders — it never usefully was, since the surrounding context value and `panel` object were already rebuilt every render. A custom panel that puts `bindings` in a `useMemo`/`useEffect` dependency array will now see it change each render; depend on the values read from it instead.
