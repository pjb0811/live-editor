---
'@jbpark/live-editor': patch
---

Fix iframe sections losing the scripts from `frame.scripts` after the canvas sections are reordered. Moving an iframe in the DOM reloads it with a fresh document, but the frame skipped every script it had already loaded once, so the moved section's new document never got them. A Tailwind browser build loaded this way left the moved section unstyled. The frame now loads its scripts again whenever it gets a new document.
