---
'@jbpark/live-editor': minor
---

Added a renderEditor render prop to Editor, letting consumers fully replace the built-in CodeMirror editing surface with their own implementation while still syncing to the shared preview code automatically. Exposes formatCode (the same prettier-based formatting Core's Cmd+S uses) so a custom editor can offer equivalent format-on-save behavior.
