---
'@jbpark/live-editor': minor
---

Let consumers replace the error box shown for a canvas section that fails.

- `renderSectionFallback({ section, reason, message })` renders in place of a
  section that failed to compile (`'compile'`), threw while rendering
  (`'runtime'`), or was skipped (`'forced'`). Return `undefined` to keep the
  built-in error box. A fallback that throws reverts to the built-in one for
  that section only.
- `shouldForceSectionFallback(section)` runs before a section is compiled.
  Returning `true` skips compiling it, so none of its top-level code runs, and
  renders the fallback with reason `'forced'`.

Neither changes rendering, memoization or error isolation when omitted. Both
types are exported: `DndRenderSectionFallback` and `DndSectionFallbackArgs`.
`Live.Error.Boundary`'s `fallback` also receives a `reset` function as its
second argument.
