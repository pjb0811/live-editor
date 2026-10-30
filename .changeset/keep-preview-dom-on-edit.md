---
'@jbpark/live-editor': patch
---

Typing in the code editor no longer rebuilds `Live.Preview`. As with canvas sections, the preview now renders each compile under a component type that survives a recompile, so React updates only what changed and the preview keeps its state, as long as the edit leaves the component's hook calls alone. An edit that adds, removes or reorders hook calls still remounts it.
