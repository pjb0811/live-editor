---
'@jbpark/live-editor': patch
---

Removing an attribute that sits alone on its line now also removes the comments after it on that line. They used to stay behind and end up beside the previous attribute, describing the wrong thing.
