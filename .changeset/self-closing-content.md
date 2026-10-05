---
'@jbpark/live-editor': minor
---

Refuse `innerText` and plain `innerHTML` edits on a self-closing element such as `<img />`. They used to report success without changing the source, so the edit was lost without an error. `update()` and `updateAll()` now fail with the new `UpdateFailure` reason `self-closing`, and `Live.Dnd` shows the error toast or calls `onEditError`, with the new `messages.editErrors.selfClosing` text. Clearing the content of a self-closing element still succeeds, and `type: 'richtext'` still works there, since it writes `dangerouslySetInnerHTML`.
