---
'@jbpark/live-editor': patch
---

Fix iframe previews staying on the light theme when the host page is in dark mode. With `syncStyle`, an iframe preview copied the host's stylesheets but not the class or attribute the theme is switched with on the host's `<html>` (`.dark`, `data-theme="dark"`), so dark-mode selectors never matched inside the iframe, while the same code in `shadow` mode followed the host. `syncStyle` now also mirrors the host `<html>`'s classes and `data-*` attributes onto the iframe's `<html>` and keeps them in sync, so a theme switch reaches the preview as it happens. Classes the preview set on its own root are kept, and other attributes (`style`, `lang`, `dir`) are left alone.
