---
'@jbpark/live-editor': patch
---

A canvas section's content is now `inert`, so the keyboard can't reach it, as the pointer already couldn't: Tab goes from section to section, and Enter no longer runs a button or follows a link inside a section. Each section is named by its section name for screen readers, since its content is no longer read. The element picker works as before.
