---
'@jbpark/live-editor': major
---

Draw the rest of the editor chrome without `@jbpark/ui-kit`

- The desktop layout's three panes are plain markup now. Each side pane has a `role="separator"` handle. You can drag it, move it with the arrow keys, Home and End, or collapse and restore the pane with Enter or a double-click.
- The mobile palette and properties Drawers are a modal `<dialog>` that slides up from the bottom. Escape, the close button or a click on the backdrop closes them.
- The default edit error toast is the editor's own, styled by the `--live-editor-*` tokens. It no longer goes through ui-kit's `Toast`, so ui-kit's toast settings don't apply to it. Pass `onEditError` to show errors your own way, as before.
- `Live.Editor` uses `@uiw/react-codemirror` directly instead of ui-kit's `CodeEditor`, with the same options and Cmd/Ctrl+S formatting.
- New `messages.canvas` keys: `close` (the Drawers' close button), and `resizePalette` and `resizePanel` (the pane handles).
