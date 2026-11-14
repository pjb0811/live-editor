---
'@jbpark/live-editor': minor
---

Add `useLiveHistory`, undo and redo for a document edited with `Live.Dnd` and `Live.Editor`. Each canvas edit is one step, a burst of typing in the code editor is one step, and Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z and Ctrl+Y work outside text fields and the code editor. `Live.Dnd` and `Live.Editor` now pass a second argument to `onChange`, `{ source: 'dnd' }` or `{ source: 'editor' }`, which a one-argument `onChange` ignores. The `@jbpark/use-hooks` dependency moves to ^4.8.0.
