---
'@jbpark/live-editor': patch
---

Make `Live.Editor` keep to the documented code-ownership contract.

- Without `value`, the editor dropped every edit: it kept no state of its own,
  so typing never showed up or reached the preview. It now holds a draft that
  shows each keystroke at once, pushes it to `Live`'s shared code after
  `debounce`, and follows changes other surfaces make to that code, so a
  `Live.Dnd` without `value` beside it stays in step. Without `defaultValue`,
  it starts from the shared code instead of always from the built-in template.
- A push still waiting for `debounce` used to be dropped when the editor
  unmounted, leaving `Live.Preview` on older code than the host had. It now
  runs at once on unmount, and when focus leaves the editor, so clicking into
  another surface right after typing works on the typed code.

The rules are documented under "Who owns the code" in Editor Mode. Requires
`@jbpark/use-hooks` 4.1.0.
