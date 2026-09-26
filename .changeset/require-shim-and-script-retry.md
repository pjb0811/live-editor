---
'@jbpark/live-editor': patch
---

Fix two defects in the preview compile/script pipeline, and translate its two
remaining Korean error messages to English.

- `compile()`'s `require` shim tested a module's truthiness instead of its
  presence, so a module whose value is legitimately `0`, `''`, `false`, or
  `null` was reported as missing — even though the compilation cache already
  supports and compares primitive modules by value.
- `getCachedScriptBlob()` dropped its in-flight entry only on success, so one
  failed fetch left a rejected promise in the map that every later caller
  adopted: that script stayed unloadable for the rest of the session even
  after the network recovered. `preloadScripts()` also no longer raises an
  unhandled rejection when a preload fails.
