---
'@jbpark/live-editor': minor
---

Export `getFieldKind` and `isStructuralFieldKind` from `@jbpark/live-editor/dnd`, along with their `FieldKind` and `FieldKindBinding` types. `getFieldKind(binding)` returns which built-in control `Live.Dnd.Field` renders for a binding (`'items'`, `'children'`, `'richtext'`, `'select'`, `'number'`, `'text'`, and so on). `Field` now picks its control with this same function, so a custom panel can ask the library instead of copying its checks. `isStructuralFieldKind(kind)` is `true` for `'items'` and `'children'`, the two kinds whose value holds further data-bound elements. A headless panel can use it to send those bindings to `useDndItems`/`useDndChildren` at every depth. `Field`'s behavior is unchanged.
