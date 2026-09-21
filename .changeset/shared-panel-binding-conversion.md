---
'@jbpark/live-editor': patch
---

Resolve a data-bound element into panel bindings through one shared conversion. The built-in panel, a custom panel's `useDndPanel()` bindings and the nested editors inside an `items` value previously repeated the same `DataAttrNode` -> `PanelBinding` mapping, so a binding field could reach one surface and silently miss the others. All three now read the same conversion, which keeps `widget`, `render`, constraints and consumer-defined `meta` consistent across them. No public API change.
