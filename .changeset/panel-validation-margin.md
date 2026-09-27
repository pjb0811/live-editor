---
'@jbpark/live-editor': patch
---

The built-in panel's validation error no longer shifts the fields below it. The error paragraph had no bottom margin of its own, so in a page without a CSS reset it picked up the browser's default `1em` (12px), pushing every field below down by 8px when the error appeared and moving them back when it cleared. It now sets `margin-bottom: 0`, so the gap to the next field stays at the panel's own 4px. Pages that already run Tailwind's preflight or another reset look the same as before.
