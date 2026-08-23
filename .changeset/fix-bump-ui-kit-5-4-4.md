---
'@jbpark/live-editor': patch
---

Bumped `@jbpark/ui-kit` from `^5.4.1` to `^5.4.4`, which fixes dark mode not applying on hosts that toggle `[data-theme='dark']` instead of the `.dark` class (5.4.3), and a `[data-slot]`-scoped preflight normalization for consumers without Tailwind preflight, so bare buttons no longer pick up the browser's default `outset` border/native `appearance`/UA font (5.4.4). Verified with a real build: `dist/style.css` includes the new `[data-slot]` normalization and `data-theme` dark-mode rules, with no bare-tag selectors leaking in.
