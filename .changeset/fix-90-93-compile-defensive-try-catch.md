---
'@jbpark/live-editor': patch
---

Hardened Preview and the DnD renderer's compile() calls with try/catch, matching Client's existing defensive pattern, so a future regression in compileModule can't crash the whole tree instead of falling back to the existing error UI.
