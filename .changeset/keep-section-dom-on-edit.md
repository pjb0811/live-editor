---
'@jbpark/live-editor': patch
---

Editing a field no longer rebuilds the edited canvas section. Each edit recompiles the section into a new component, which React treated as a new type and remounted, so the section's whole DOM was replaced and its state, images and animations reset on every edit. The section now renders under a type that survives a recompile, so React updates only what changed, as long as the edit leaves the component's hook calls alone. An edit that adds, removes or reorders hook calls still remounts the section.
