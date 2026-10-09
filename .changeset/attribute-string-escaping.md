---
'@jbpark/live-editor': patch
---

Editing a string attribute in the panel now writes the value by JSX rules instead of JavaScript rules. A value with a double quote no longer leaves the section unparsable, a backslash is no longer doubled (a `pattern` such as `\d+` keeps its meaning), and a typed entity such as `&amp;` stays literal. A line break or tab is written as `{"..."}`, since JSX collapses a line break plus spaces inside an attribute string. Plain values are written exactly as before.
