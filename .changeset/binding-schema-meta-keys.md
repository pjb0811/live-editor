---
'@jbpark/live-editor': patch
---

`bindings` and `bindingKeys` entries typed with `BindingRegistry` or `BindingKeyMap` now accept keys of your own, such as `group`, `tab` or `description`. They arrive in `binding.meta`, as they already did at runtime and from an inline `data-binding`, but the types rejected them. One entry's type is exported as `BindingSchema`.
