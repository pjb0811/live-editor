---
'@jbpark/live-editor': minor
---

Make the `Live.Dnd` palette and canvas usable from the keyboard, and let the host confirm a delete. Palette cards and canvas sections could be reached with Tab and announced themselves as buttons, but did nothing on Enter, and sections couldn't be moved without a pointer.

- Enter on a canvas section selects it, like a click. Enter on a palette card adds it, like a double-click.
- Space picks a section or card up, the arrow keys move it, Space or Enter drops it, and Escape cancels. This is dnd-kit's keyboard sensor, with Enter kept for selecting. Screen readers hear the section's name and position rather than its generated id.
- Palette cards show a focus ring for keyboard focus. They had `outline-none` and no replacement.
- New `onBeforeDelete` prop: `(section) => boolean | Promise<boolean>`. It runs before a section is deleted from the canvas, the panel, or a custom panel's `onDelete`, and `false` keeps the section. A promise is waited for, and the delete then applies to the document as it is at that point. A throw or rejection keeps the section.
