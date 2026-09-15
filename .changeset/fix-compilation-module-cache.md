---
'@jbpark/live-editor': patch
---

Invalidate compiled results when injected module values or references change, so separate previews using the same source with different module implementations do not reuse each other's output. Equivalent module maps still reuse cached results regardless of key insertion order, and all module variants share the existing 50-entry LRU limit.

Module objects and functions are compared by reference rather than serialized. To change an implementation in React, pass a new module object and a new modules map. In-place mutation of a module's properties is not automatically detected; direct compile callers can clear the compilation cache before recompiling.
