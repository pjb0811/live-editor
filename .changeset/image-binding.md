---
'@jbpark/live-editor': minor
---

Add a `type: 'image'` binding and `Live.Dnd`'s `onUpload`. An image field shows a URL input with a thumbnail of the current value and accepts any image source, relative paths and `data:` URLs included. With `onUpload`, it also gets a file picker whose resolved URL is written like a typed one. A rejected upload is reported through `onEditError` as an `upload` error. `BindingType`, `FieldKind` and `DndEditError` each gain a member, so an exhaustive `switch` over them needs a new case, and `LiveMessages` gains `panel.imagePlaceholder`, `panel.chooseImage`, `panel.uploadingImage` and `editErrors.uploadFailed`.
