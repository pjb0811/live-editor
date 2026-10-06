---
'@jbpark/live-editor': patch
---

Fix `autoHeight` cutting off overlays placed against the viewport, such as a bottom drawer. A `position: fixed` element's percentage `height` and its `top` or `bottom` resolve against the iframe's viewport, and the iframe's height was itself what was being measured, so a drawer with `height: 50%` stayed half of a section that never grew, and a dialog centred with `top: 50%` was cut in half. The measurement now sizes the viewport to the height the section can show, reads each fixed or absolute element's real bottom edge, and skips one moved entirely outside the viewport.
