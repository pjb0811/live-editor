---
'@jbpark/live-editor': patch
---

Stop a single failing canvas section from unmounting the whole DnD editor (#246).

`dnd/renderer.tsx` reimplemented `preview/client.tsx`'s compile-and-render
pipeline instead of sharing it, and the two drifted: `client.tsx` wrapped the
compiled component in an error boundary, `renderer.tsx` wrapped it in nothing.
Since `renderer.tsx` renders every section on the canvas, a runtime error in
any one of them propagated past `Dnd` and unmounted palette, canvas and panel —
while the same error inside `<Preview>` was caught and displayed.

- `renderer.tsx` now wraps each section in `Error.Boundary`, keyed on the
  section's preview string so the next edit clears a caught error without a
  remount. Errors stay local rather than going to `ErrorContext`, whose single
  `error` string would let N sections overwrite each other. `Error.Guard` is
  deliberately not used here: it listens on `window`, not on its subtree, so one
  per section would mean every section reporting any single error.
- A section whose code fails to compile now shows a `Compile Error` panel in its
  slot instead of rendering as a silent blank, matching `client.tsx`.
- The duplicated logic behind the drift is now shared: `useCompiledModule`
  (module merge + `compile()` + error shaping) and `useDynamicTailwind` (the
  callback-ref DOM scan, whose 12-line explanatory comment existed verbatim in
  both files) live in `preview/`, and both callers use them.

No public API change.
