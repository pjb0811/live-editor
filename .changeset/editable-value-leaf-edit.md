---
'@jbpark/live-editor': patch
---

`setEditableValue` now changes only the leaf at `path` and leaves the rest of the value as written. It used to re-serialize the whole value as JSON, so editing one field of an `items` array turned every JSX value in it into plain text, dropped functions such as `onClick`, and lost comments and formatting. A string keeps the quotes it was written with, and a JSX leaf stays JSX when the edited text still is. A path it can't point at with certainty, such as one an object spread could override, returns the value unchanged.
