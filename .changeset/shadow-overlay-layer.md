---
'@jbpark/live-editor': patch
---

Open overlays inside the preview in `frame.mode: 'shadow'`. The `container` a preview component receives is now an overlay layer inside the shadow root that covers the preview's box, instead of an element outside the shadow root (the canvas, or `document.body` in `Live.Preview`). A modal or drawer portaled into it, such as ui-kit `Modal` or `Drawer` with `container={container}`, now opens over the preview rather than over the whole page, and gets the preview's styles. The layer lets clicks through to the preview under it, and the preview's own `fixed` and `absolute` elements are placed as before.
