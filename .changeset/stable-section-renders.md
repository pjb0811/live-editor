---
'@jbpark/live-editor': patch
---

Stop re-rendering every canvas section on every edit. `Live.Dnd` without a
`modules` prop created a new empty object each render, and a `frame` written
inline (`frame={{ mode: 'iframe' }}`) was a new object each render too; either
one defeated the per-section memo, so each edit re-rendered and re-looked-up
the compiled module of every section. Past the compilation cache's 50 entries
that became a Babel recompile of most sections per edit.

`modules` now defaults to one shared object, in `Live.Preview` as well, and a
section compares `frame` by value. Measured from committing a panel edit to
the canvas showing it, in Chromium with an inline `frame`:

| Sections | Before   | After  |
| -------- | -------- | ------ |
| 9        | 78 ms    | 54 ms  |
| 45       | 177 ms   | 79 ms  |
| 90       | 1,379 ms | 127 ms |
