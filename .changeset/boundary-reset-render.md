---
'@jbpark/live-editor': patch
---

`Live.Error.Boundary` no longer renders its fallback one more time when `resetKeys` change after an error. The error used to be cleared after that render had already committed, so the fallback rendered again with the new props, and any of its effects keyed on them ran again, on every recovery. Nothing on screen changed. The error is now cleared in the render that sees the new keys, and a throw with the new keys is still caught.
