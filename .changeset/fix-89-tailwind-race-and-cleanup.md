---
'@jbpark/live-editor': patch
---

Fixed a race condition where rapid code edits could let a stale Tailwind CSS generation request overwrite the current one, and fixed dynamically-generated CSS staying injected after turning dynamicTailwind off.
