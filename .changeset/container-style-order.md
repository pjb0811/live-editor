---
'@jbpark/live-editor': patch
---

Fix an iframe preview collapsing to a pixel when `syncStyle` is switched on after the frame has mounted and the host page sets `html { height: 100% !important }`. Each frame keeps a style that fixes its `<html>` to the reference height `vh` units resolve against, and the host's synced styles have to stay in front of it. A first sync that ran after that style existed appended the host's copies behind it instead. The host rule then won on order, `vh` resolved against the frame's own height, and the auto-height loop shrank the frame to 1px (measured with a `50vh` section in Chromium). Synced styles now always go in front of the frame's own style, however late the first sync runs.
