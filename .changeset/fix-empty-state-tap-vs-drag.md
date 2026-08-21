---
'@jbpark/live-editor': patch
---

Fixed `Live.Dnd`'s empty-canvas placeholder always saying "Drag a component from the left to add it", even below the mobile breakpoint where the palette lives in a `Drawer` over the canvas and dragging isn't the available gesture there — only tapping is (see `draggable.tsx`'s existing `tapToAdd` handling). The message now follows the same `isMobile` condition that already drives `tapToAdd`, showing "Tap a component to add it" instead when the palette is in the drawer.
