---
'@jbpark/live-editor': patch
---

Load the Tailwind compiler only when `dynamicTailwind` is on. It and its theme
used to be part of every consumer's initial bundle, about 300 kB before
compression, whether or not a preview ever compiled a class. It is now fetched
the first time a preview with `dynamicTailwind` renders, and never otherwise.
