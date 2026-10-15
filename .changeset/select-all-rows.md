---
'@jbpark/live-editor': minor
---

The built-in Items and Children editors get a "Select all" checkbox above their rows. It's checked when every row is selected and indeterminate when only some are. Clicking it selects every row, or clears the selection once all are selected, so a bulk action can reach the whole list without clicking each row. It follows the Items editor's structure lock, and the item limits from `minItems` / `maxItems` still disable bulk duplicate and delete. The text comes from the new `selection.selectAll` message.
