---
'@jbpark/live-editor': patch
---

Canvas sections no longer mount twice when `Live.Dnd` first renders. The built-in layout started from the mobile arrangement until the screen was measured, then switched to the desktop one under another parent, which mounted every section again: in the in-place frame mode a section's effects ran twice as often and its state was created twice. Both arrangements now keep the canvas in the same place, so switching between them, on the first render or when the window crosses the breakpoint, doesn't remount the sections.
