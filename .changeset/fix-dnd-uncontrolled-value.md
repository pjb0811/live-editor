---
'@jbpark/live-editor': patch
---

Fixed `Live.Dnd` used without a `value` prop (uncontrolled usage) silently discarding every edit. `Dnd` wrote edits through `setCode` into `PreviewContext` but only ever read its canvas from the `value` prop, never from the context — so with no `value` supplied, a dragged-in section was added and then vanished on the very next render, forever re-deriving from `DEFAULT_TEMPLATE`. Mirrors the fallback `Client` (`preview/client.tsx`) already has for the same dual-source situation: `value` now resolves as `_value || code || DEFAULT_TEMPLATE`, so `<Live><Live.Dnd /></Live>` works standalone.
