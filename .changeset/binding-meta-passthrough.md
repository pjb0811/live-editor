---
'@jbpark/live-editor': minor
---

Carry consumer-defined `data-binding` keys through as `BindingItem.meta`/`PanelBinding.meta` instead of silently stripping them, and degrade an unrecognized `type` inside a `render` map to untyped instead of dropping the whole entry (#234).

`parseBinding` was designed as a sanitizer for this library's own fixed schema, not as a transport for consumer-defined data — any key on a `data-binding` entry beyond the fixed set (a step increment, a unit suffix, a group name, ...) was silently dropped, giving a custom `renderPanel` no supported way to declare its own per-field configuration. `rawBindingItemSchema` now uses `.passthrough()`, and anything it doesn't declare survives under a new, namespaced `meta?: Record<string, unknown>` field on `BindingItem`/`PanelBinding` — absent (not an empty object) when nothing extra was authored, so existing content and existing `PanelBinding` consumers see no shape change unless they actually author extra keys.

Also fixes an inconsistency one level down: an authored `type` inside a binding's `render` map that this library doesn't recognize used to delete that key entirely, contradicting the top-level binding's own documented behavior (an unrecognized top-level `type` degrades to `undefined` rather than dropping the item). `BindingRenderLeaf.type` is now optional, matching `BindingItem.type`, so a `render` map leaf can legitimately be untyped instead of missing.

No breaking change: both are additive, and every previously-valid `data-binding` literal still produces the same effective behavior.
