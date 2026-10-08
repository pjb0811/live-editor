---
'@jbpark/live-editor': patch
---

Editing an `innerText` binding now overwrites whitespace that sits on the same line as the text, such as the spaces in `<h1> Old </h1>`. The panel trims that whitespace, so it could not be seen or removed, and the new value used to land between the old spaces. Whitespace that contains a line break is still kept as layout.
