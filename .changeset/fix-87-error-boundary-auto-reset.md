---
'@jbpark/live-editor': patch
---

Fixed ErrorBoundary (and Preview's own runtime-error state) staying stuck on a stale error screen after the underlying code was fixed. ErrorBoundary gained an optional resetKeys prop, but this is a backward-compatible fix — every real usage in Preview/Client now auto-recovers without any consumer action needed.
