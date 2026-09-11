---
'@jbpark/live-editor': patch
---

Fix array edits corrupting the document when the binding declares no `type`.

Adding, removing or reordering an item in the panel's array editors rewrote `items={[...]}` into a quoted string attribute — `items="[{\n  key: '1', label: <p data-id=\"a\">…"` — leaving the section unparseable, so the panel emptied and the preview stopped updating. Both shipped sections hit this: `FAQ` and `Stats` declare `{ label: 'FAQ Items', property: 'items' }` with no `type`, and the serializer only recognized an array when `type: 'array'` was spelled out.

`update()` now also reads what the attribute already holds, the same evidence `getStructuredValue()` uses on the way out. An attribute authored as an array or object literal keeps its expression form when the committed value is itself an array or object literal. Anything else is unchanged: `className={cn(...)}` and `items={rows}` are left alone, and a plain string committed against a text attribute is still written as a string literal.

This affects every panel mode equally — the built-in `Items` control, a wrapped `Live.Dnd.Panel`, and custom markup over `useItemsEditor` all commit the array as source text through the same path.
