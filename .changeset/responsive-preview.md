---
'@jbpark/live-editor': minor
---

Add a viewport-size toggle (Desktop/Tablet/Mobile presets + custom width input) to the demo app's toolbar, resolving #35. Applied by composing `frame.style.width` on the existing `Live.Preview`/`Live.Dnd` `frame` prop — no changes to `Frame`/`IFrame` themselves.
