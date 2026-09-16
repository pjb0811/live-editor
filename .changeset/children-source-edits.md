---
'@jbpark/live-editor': minor
---

Preserve JSX source during Children reorder, remove, duplicate, and add operations. Keep intervening expressions, text, and comments intact; give copies fresh IDs and refuse unsupported or stale edits without changing source.

Expose useChildrenEditor for custom panels and reconcile selection after accepted edits to prevent later bulk actions from targeting the wrong child. Keep safe legacy JSON children updates supported.
