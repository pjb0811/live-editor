---
'@jbpark/live-editor': patch
---

Passing `modules` inline (`modules={{ Chart }}`) no longer re-renders and recompiles every canvas section on each edit. A fresh `modules` object with the same entries is now treated as unchanged by `Live.Dnd` and `Live.Preview`; replacing, adding, or removing a module still recompiles. At 90 sections this took an edit from 90 Babel runs to one.
