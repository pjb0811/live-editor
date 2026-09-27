---
'@jbpark/live-editor': minor
---

Update `@jbpark/ui-kit` to 10. live-editor's own API is unchanged, but the
`ui-kit` module that previewed code imports (`import * as ui from 'ui-kit'`)
is now ui-kit 10, so a stored document can need updating if it relies on what
10.0 changed:

- `Button` (and `Container`, `Layout.Content`) no longer take `asChild`. Pass
  the element as `render={<a href="…" />}` and keep the content as children;
  for `Button`, add `nativeButton={false}` when that element is not a button.
- `Drawer` no longer takes `draggable`, and bottom drawers can no longer be
  dragged to dismiss.
- `Checkbox`, `Switch`, `Radio`, `Select`, `Slider`, `Progress`, `Collapse`
  and the dialogs are rebuilt on Base UI. Their documented props are kept, but
  their DOM is different: a `Checkbox` or `Switch` is no longer a native
  control, so read `aria-checked` / `aria-disabled` rather than the `checked` /
  `disabled` DOM properties.

The built-in panel follows the same change: its selection checkboxes report
`aria-disabled` instead of a native `disabled` property.
