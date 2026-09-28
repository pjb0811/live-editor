---
'@jbpark/live-editor': minor
---

Export `resolvePanelBindings` and `withPanelCommit` from `@jbpark/live-editor/dnd`, along with their `PanelBindingSource` and `PanelBindingData` types. They are the two steps behind `useDndPanel().bindings`: the first reads a `DataAttrNode`'s `data-id` and `data-binding` into bindings (or returns `null` when the element isn't editable), and the second attaches `onChange`, committing through `onNodeChange`. A custom panel can now build `PanelBinding`s for elements the panel doesn't hand over itself, such as the fields inside each child from `useDndChildren`, and render them with `Live.Dnd.Field` instead of reading the AST by hand.
