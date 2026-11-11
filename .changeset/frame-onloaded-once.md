---
'@jbpark/live-editor': patch
---

Call `frame.onLoaded` once per iframe document

An `onLoaded` passed inline, or an inline `frame.scripts` array, made the iframe set its document up again on every render of the frame: it re-applied the host styles and called `onLoaded` again. An `onLoaded` that sets state could loop. `onLoaded` now runs once per iframe document: after the initial load, and again only when moving the iframe reloads it. A script added to `scripts` later is still injected.
