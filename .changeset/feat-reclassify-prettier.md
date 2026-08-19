---
'@jbpark/live-editor': patch
---

Moved `prettier` from `peerDependencies` to `dependencies`. It's an internal implementation detail (used for the editor's Cmd+S formatting), not something consumers were meant to supply their own version of — a missing peer previously made the whole package fail to load under package managers that don't auto-install peers (pnpm, yarn).
