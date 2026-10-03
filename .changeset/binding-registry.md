---
'@jbpark/live-editor': minor
---

Add a binding registry: `Live.Dnd`'s new `bindings` prop maps a tag name, as written in the source (`ui.Button`, `h2`), to the binding entries every element of that tag gets. Markup then needs only a `data-id` instead of repeating the same `data-binding` on every element, and the schema stays out of the generated code. An element's own `data-binding` still takes precedence, whole, and `data-binding={[]}` opts one element out. The registry applies to the built-in panel, `useDndPanel()`, `Live.Dnd.Field`, and elements inside `items` and `children` values. The AST helpers take it as an option: `extract(source, { bindings })`, `update(..., property, { bindings })` and `updateAll(code, entries, { bindings })`. The `BindingRegistry` type is exported from the package root and `@jbpark/live-editor/utils/ast`, along with `getRegistryBindings` and `readNodeBindings`.
