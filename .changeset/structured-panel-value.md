---
'@jbpark/live-editor': major
---

Deliver `PanelBinding` values as their real JS type and serialize once at the AST boundary

`PanelBinding.value` is now `unknown` — a real `number`/`boolean`/`object`/`array`/`string` rather than always a string — and a new `PanelBinding.rawValue: string` carries the exact source text. `onChange` now takes `unknown` and serializes the value a single time, at the AST boundary where the declared `type` is known, so there is no string-vs-expression guessing on either side. This fixes a string whose text begins with `{` or `[` being misclassified as a JS expression, and lets `validateBindingValue`'s `min`/`max` compare against an actual number instead of coercing a numeric string.

Breaking change for custom `renderPanel` consumers:

- `binding.value` is no longer a string. Use `binding.rawValue` for an `<input>` `defaultValue`, a `<select>` value, and for `flattenEditableValue`/`setEditableValue`; switch on `binding.value` for its real type.
- `binding.onChange` accepts the value as its real type (`onChange(42)`, not `onChange('42')`).
