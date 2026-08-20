---
'@jbpark/live-editor': patch
---

Bumped `@jbpark/ui-kit` from `^5.3.0` to `^5.4.1`, which fixes `@jbpark/ui-kit/style.css` shipping Tailwind's preflight (a document-wide reset that flattened a host page's typography — see #207) and a follow-up regression where some ui-kit components lost their own list/margin reset. Verified with a real build: `dist/style.css` no longer contains any bare-tag rules, and loading it on a host page leaves `h1`/`p`/`body` styling untouched.
