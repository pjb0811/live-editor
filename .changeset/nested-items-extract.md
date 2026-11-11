---
'@jbpark/live-editor': patch
---

Stop listing JSX inside an `items` value twice when its element sits under a `children` binding

`extract()` leaves the data-bound JSX inside an `items` value out of its top-level results, since the Items editor reads those elements itself. That held only when the element with the `items` binding was itself a top-level result. Under an element with a `children` binding, the JSX inside its `items` was listed at the top level too, so the panel showed the same element twice. It now appears once, in the Items editor.
