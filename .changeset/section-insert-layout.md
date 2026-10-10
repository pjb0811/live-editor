---
'@jbpark/live-editor': patch
---

Adding or copying a section now keeps the document's layout. The new section starts on its own line at the indentation of the sections around it, and the section after it keeps its indentation, where it used to be pushed to column 0. In a document with CRLF line endings the new section is written with CRLF too, so the file no longer ends up with mixed line endings. A document written on one line, an empty container, and a section that shares its line with other code are handled as before.
