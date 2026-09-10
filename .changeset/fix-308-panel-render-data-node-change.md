---
'@jbpark/live-editor': minor
---

Forward the node-level commit callback to `renderPanel`. `PanelRenderData` now carries `onNodeChange`, so a custom panel that re-embeds `Live.Dnd.DefaultPanel` can spread the render data straight in (`<Live.Dnd.DefaultPanel {...data} />`) and keep nested array/children edits working — previously those edits were silent no-ops, affecting 5 of the 8 shipped sections (9 of Stats' 10 editable elements).

`onNodeChange` is a required field on `PanelRenderData`. Reading it off the argument in a `renderPanel` is unaffected; only code that constructs a `PanelRenderData` object by hand (a test helper or a re-shaping wrapper) needs to add the field.
