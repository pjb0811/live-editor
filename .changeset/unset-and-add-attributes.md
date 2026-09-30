---
'@jbpark/live-editor': minor
---

Switch an optional attribute off and on from the panel. Committing `undefined` through a binding's `onChange`, `onNodeChange`, `onNodesChange` or `update()` now removes the attribute, and committing a value for an attribute the element doesn't carry adds it. Before, `undefined` was written as the text `"undefined"` (`title="undefined"`, `size="undefined"`, or "undefined" in an element's text), and a binding for a missing attribute failed with `attribute-not-found`, so an optional prop couldn't be toggled at all.

- An empty string still writes `prop=""` on an attribute that's there, and leaves a missing one missing.
- `undefined` empties `innerText` and `innerHTML`. Removing `children` as a whole is refused with `unsupported-syntax`.
- A `required` binding can't be removed. `update()` refuses it with a new `'required-property'` failure, which the panel reports through `onEditError`.
- `PanelBinding.present` is `false` while a bound attribute is missing. A missing attribute's field is no longer read-only (`canEditValue`), since a value adds it.
- A new attribute goes after the element's last one, on its own line when the tag puts one attribute per line.

A binding whose `property` has a typo used to be reported as `attribute-not-found`. Now it adds an attribute with that name.
