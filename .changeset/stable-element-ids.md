---
'@jbpark/live-editor': patch
---

Fill a section's empty `data-id`s the same way in the panel and the canvas preview. The panel used to fill them with random ids, new each time the section's code changed, while the preview rendered them empty. Now both derive them from the section's id in document order (`<section id>-1`, `-2`, ...), skipping ids the section already uses. So an element in the preview carries the `data-id` its fields have in `useDndPanel().bindings`. As before, the ids reach the source only with the first edit to the section.
