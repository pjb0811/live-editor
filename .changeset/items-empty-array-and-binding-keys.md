---
'@jbpark/live-editor': patch
---

Make the empty-array state in the Items panel explain itself instead of showing a permanently disabled Add button. An array binding is editable only while it holds at least one item — the panel copies an existing item and never guesses the shape of a new one — so an array authored as `[]` now renders that contract as a notice pointing at the code editor. This is the same invariant `removeArrayItems` already maintained by refusing any edit that would empty an array, now stated in one place and applied consistently to both the object and primitive branches. A parse failure is reported separately from an empty list rather than both collapsing to `Items (0)`.

Key panel field lists by property and label together instead of by label alone. A label is free text from the authored `data-binding` and carries no uniqueness guarantee, so two bindings sharing one (for example `Color` on both `color` and `backgroundColor`) collided as React keys, producing a duplicate-key warning and letting a field's local control state carry across to the wrong binding. The commit path has addressed bindings by property since 58e2171; the keys in `FieldGroup`, `Node` and the nested item groups now agree with it.
