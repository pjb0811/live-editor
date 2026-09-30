---
'@jbpark/live-editor': minor
---

Move between canvas sections from the keyboard, delete the focused one, and keep the selection in view. On a focused canvas section, Arrow Up and Arrow Down go to the previous or next section and select it, and Home and End go to the first or last. Delete or Backspace deletes the section through `onBeforeDelete`, then moves focus to the section that took its place, or the previous one, so focus isn't dropped on the page. These keys only count on the section itself, not inside its content, and not while a section is picked up. The selected section also scrolls into view whenever it ends up out of sight, including after the panel's move buttons.
