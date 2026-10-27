---
'@jbpark/live-editor': patch
---

The built-in panel's checkbox, date picker, select and rich text editor are now named by their field label. The label points at the checkbox and the date picker with `for`, and the select and the rich text editor point at the label with `aria-labelledby`. A date picker's validation error is tied to it with `aria-describedby` and `aria-invalid`, as the text inputs already were. The `@jbpark/ui-kit` dependency moves to `^10.5.0`, which adds these props.
