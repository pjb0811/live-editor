---
'@jbpark/live-editor': patch
---

Duplicating or adding a child in the panel's Children editor now keeps the parent's layout. In a parent written one child per line, the copy goes on its own line under the last child with the same indentation (and the file's line ending), where it used to land at column 0 against the closing tag. A parent on one line, an empty parent, and a last child followed by a comment on its line are handled as before.
