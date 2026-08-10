---
'@jbpark/live-editor': patch
---

Fixed the runtime/compile error overlay staying up indefinitely after the underlying code was fixed. ContextProvider's setCode now clears the stale error in the same update that changes the code.
