---
'@jbpark/live-editor': patch
---

Fix a full-height section overflowing the `Live.Dnd` canvas when the layout around it has vertical margins, or when the canvas itself has vertical padding. The reference height that `vh` units resolve against in each section frame took the canvas height and subtracted the border and padding of the wrappers between the canvas and the frame. It didn't subtract their margins, or the canvas's own padding. A `100vh` section was therefore taller than the space it had, by that amount, and the canvas scrolled. Both are subtracted now. The built-in layout has neither, so it renders the same as before.
