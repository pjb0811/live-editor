---
'@jbpark/live-editor': patch
---

In the `iframe` frame mode, a canvas section's content can no longer take focus by itself. An `autoFocus` input, or one focused by the section's own code, used to take focus when the canvas loaded, so keys went to it instead of the editor. The content is now `inert` inside the frame's document too, as it already was in the other modes, except while the element picker is on.
