---
'@jbpark/live-editor': minor
---

Keep the `Live.Dnd` canvas and panel populated while the document doesn't parse. A source with a syntax error, which is what the code editor holds for most of a keystroke, used to empty the canvas and the panel until it parsed again. They now show the last version that parsed, with a notice on the canvas and in the panel, and stay read-only until the source parses again.

- An edit tried while the document doesn't parse is refused and reported through `onEditError`, or a toast by default. The error has a new `DndEditError` shape: `{ type: 'parse', target: 'document', reason: 'parse-error', error }`. Such edits used to call `onChange` with the source unchanged, and say nothing.
- `useDndPanel()` returns `readOnly`, which is `true` in that state.
- `useDndLayout()` returns `documentError`: `'parse-error'`, `'container-not-found'` or `null`.
- A document that has never parsed shows "The document has a syntax error" on the canvas instead of "No sections available".
