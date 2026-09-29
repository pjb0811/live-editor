---
'@jbpark/live-editor': patch
---

Lay out the preview iframe as a block. It used the browser default, inline, so each frame sat on a text baseline and left a gap of about 4px below it. In `Live.Dnd`, where every canvas section has its own auto-height frame, those gaps added up to height no content accounted for, which could put a scrollbar on the canvas. A `style.display` passed through `frame` still takes precedence.
