---
'@jbpark/live-editor': minor
---

A function binding's code editor now checks `pattern`, `minLength`, `maxLength` and `required` before saving, as every text field does; it used to save without them. A new binding field, `optionsOnly`, makes `options` the only choice: `validateBindingValue` rejects any other non-empty value with the new `validation.notAnOption` message, and the built-in panel and `uiKitFields` always draw the select, showing a value written elsewhere as a disabled "Current" entry (`panel.currentValue`). A select whose value isn't one of its options now shows that entry too, instead of the first option. `PanelBinding` and `BindingFieldSpec` gain `optionsOnly`, and `LiveMessages` gains the two message keys.
