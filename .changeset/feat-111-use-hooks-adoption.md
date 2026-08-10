---
'@jbpark/live-editor': patch
---

Internal refactor: adopted @jbpark/use-hooks 3.0.0's useKeyPress, useResizeObserver, useMutationObserver, useEventListener, and useDebouncedValue in place of hand-rolled window/DOM listener wiring in the editor shortcut handling, iframe auto-height/style-sync, error listeners, and debounced code commits. No intended behavior change.
