---
'@jbpark/live-editor': patch
---

Editing an `innerText` binding now escapes the text for JSX. Typing `<`, `>`, `{` or `}` used to leave the section unparsable or turn `{x}` into an expression, and a typed `&amp;` was read back as `&`. These are now written as entities (`&lt;`, `&gt;`, `&#123;`, `&#125;`, `&amp;amp;`), which the panel reads back as typed. Text without these characters is written exactly as before.
