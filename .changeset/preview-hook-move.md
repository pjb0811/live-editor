---
'@jbpark/live-editor': patch
---

Recover when an edit moves a hook from one component to another

A preview keeps its component mounted across a recompile while the list of hook calls in the source stays the same. The list is read from the whole document, so moving a hook from one component into another kept it the same while the root component's own hook count changed. React then threw `Rendered more hooks than during the previous render`, and `Live.Preview` or the canvas section showed a rendering error until "Try Again" was pressed. Now, when a new compile throws on its first render, the preview remounts once before showing an error. An error from a compile that has already rendered is shown as before.
