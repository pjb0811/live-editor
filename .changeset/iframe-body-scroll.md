---
'@jbpark/live-editor': patch
---

Fix iframe previews that couldn't scroll when the host page sets `body { overflow: hidden }`. With `syncStyle`, an iframe preview copies the host's stylesheets, so an app shell's rule that keeps its own page from scrolling also stopped a fixed-height preview (`autoHeight` off, as in `Live.Preview`) from scrolling its content. The iframe's `<body>` now gets an inline `overflow-y: auto` when the frame isn't sized to its content, which wins over any copied rule. Frames with `autoHeight`, like `Live.Dnd`'s canvas sections, are unchanged.
