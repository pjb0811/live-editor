---
'@jbpark/live-editor': patch
---

Fixed `renderPanel`'s `PanelBinding` silently dropping `render`, `min`, `max`, `pattern`, and `required` from each binding — a custom panel had no way to type a nested `object`/`array` key or validate a constraint, even though `validateBindingValue` was already exported for exactly that purpose. Also fixed `validateBindingValue` skipping `min`/`max` for a numeric string, which is the only form `PanelBinding.value` ever takes — the built-in panel worked around this itself with an ad-hoc `Number(next)` coercion before calling it, now removed since the exported helper handles it directly.
