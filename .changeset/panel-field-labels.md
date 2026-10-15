---
'@jbpark/live-editor': patch
---

The built-in panel's field labels now name their controls. Text, number, URL, email, phone and time fields are tied to their label by id, so a screen reader announces the label and clicking it focuses the field. A select or color field names itself with the label. A failed validation sets `aria-invalid` on the field and links the message through `aria-describedby`, and the message is announced as an alert. `Live.Dnd.Field` used in a custom panel's own markup names its control with the binding's label. Date, checkbox and rich text fields stay unnamed until ui-kit lets them take these attributes (pjb0811/ui-kit#534).
