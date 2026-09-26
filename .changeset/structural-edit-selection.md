---
'@jbpark/live-editor': patch
---

Give the Items and Children editors one selection rule, shared through a
single hook.

- Fix Items keeping a stale selection when its value changed from outside
  (undo, another field, an external `value`): the same positions then named
  different items, so a following bulk delete, move or duplicate acted on items
  the user never selected. It is now cleared, as Children already did.
- Children now keeps the selection where Items did: a moved block stays
  selected at its new positions, so it can be moved again without reselecting,
  and duplicating or adding leaves the selection as it was. It used to clear
  after every edit.

`useItemsEditor` and `useChildrenEditor` keep their return shapes. The full
rule is documented under "Selection after an edit".
