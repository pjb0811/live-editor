---
'@jbpark/live-editor': patch
---

Corrected `peerDependencies.typescript` from `~5.8.3` to `~6.0.3` to match the version this package actually builds and tests with — the old range excluded a TypeScript version that would otherwise satisfy it for any real consumer.
