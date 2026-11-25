---
'@jbpark/live-editor': patch
---

Moving a section in `Live.Dnd` now moves only that section. Before, a move across a wrapper element shifted the sections it passed into or out of the wrapper. Sections are matched by `data-id`, so a moved section is removed from its place, line included, and written next to the section before it in the new order. `replaceSections` follows the same rule; when two neighbors swap, the later one moves. Sections without a `data-id` are still paired by position.
