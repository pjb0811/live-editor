---
'@jbpark/live-editor': patch
---

Document a fix that shipped in 3.2.0 without a changelog entry: panel fields now skip no-op commits.

`Field` compared a pending edit against two different canonical values depending on the control — raw source text for some, the parsed structured value for others — so an edit that changed nothing still committed and rewrote the document. The guard now picks the comparison shape from the emitted value and is shared across the text, select, date, asset, color, and editor controls.

The code change was released in 3.2.0 (027a092, PR #361, fixing #319) but carried no changeset, so the 3.2.0 notes omit it. This entry exists to close that gap; no further behavior change is included here.
