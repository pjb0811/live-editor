---
'@jbpark/live-editor': minor
---

Translate the editor's own text. `Live` takes a `messages` prop that replaces any of it, group by group, while every other message keeps its English default: the section toolbar, the panel, empty states, edit errors and the toast, screen-reader announcements, the error boxes of `Live.Preview` and `Live.Error`, and validation messages. A `Live` nested in another inherits its messages. `useLiveMessages()` gives a custom palette or panel the same text, `defaultMessages` is the English set, and `validateBindingValue(binding, value, { messages })` takes translated validation messages. The Items and Children editors' move and delete buttons now have accessible names. A complete Korean set is on the new Localization docs page.
