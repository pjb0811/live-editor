---
'@jbpark/live-editor': patch
---

Added `syncStyle` support to `frame.mode: 'shadow'` (previously `iframe`-only), cloning the host document's `<link>`/`<style>` tags directly into the shadow root instead of the iframe document.

This complements `dynamicTailwind` rather than replacing it: `dynamicTailwind` recompiles whatever classes it finds in the rendered DOM at runtime, but only knows Tailwind's own default theme — a utility backed by a consuming app's custom theme token (e.g. ui-kit's `Button` rendering `bg-primary`, backed by its own `--primary` token) silently compiles to nothing, since that token doesn't exist in Tailwind's stock theme. `syncStyle` clones the host's _already-compiled_ CSS instead, which includes anything the host's own build knew about — covering custom theme tokens, at the cost of not covering a class that only appears in code typed at runtime (which `dynamicTailwind` still handles). Use both together for full coverage.

Verified with a real build, not just code review: the docs site's `dnd`/`editor-mode`/`custom-editor` demos (embedded via `frame.mode: 'shadow'`, see #206) now render ui-kit's `Button` with its real theme color (`oklch(0.205 0 0)`, matching ui-kit's actual `--primary` token) instead of the browser's default grey — see #210.
