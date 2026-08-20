---
'@jbpark/live-editor': patch
---

Fixed `dynamicTailwind` (on `Live.Preview`/`Live.Dnd`) silently producing no
usable CSS under `frame.mode: 'shadow'`, two separate bugs stacked together:

- `Live.Dnd`'s `Renderer` had no `dynamicTailwind` support at all — only
  `Live.Preview`'s `Client` did, so a `Dnd` rendered in `shadow` mode had no
  way to get any utility-class styling into the shadow root.
- The Tailwind compile context (`generateTailwindCSS`, used by both) never
  loaded Tailwind's theme layer, so any utility depending on a theme token —
  `text-white`, `text-5xl`, `px-5`, essentially anything beyond
  keyword-only utilities like `text-center` — silently compiled to nothing.
- Switched from regex-scanning the previewed source text to scanning the
  actual rendered DOM after mount (`generateTailwindCSSFromDOM`), so classes
  contributed by an imported component (e.g. ui-kit's `Button` rendering its
  own `bg-primary`) are picked up too, not just literal `className`/`cn(...)`
  usage in the code itself.

This unblocks the docs site's `dnd`, `custom-palette-panel`, `editor-mode`,
and `custom-editor` demos, which were rendering as blank/unstyled content
when embedded (see #206) because they run inside a doubly-nested sandboxed
iframe, where `iframe` mode's own isolation strategy doesn't work — they now
use `frame.mode: 'shadow'` with `dynamicTailwind` instead, which doesn't
depend on the sandboxed iframe's own nested-iframe capability at all.

Known remaining gap, tracked separately: `dynamicTailwind`'s DOM scan only
knows Tailwind's own default theme, not a consuming app's custom theme
extensions — a `bg-primary` utility backed by a project-specific
`--color-primary` token (as ui-kit's `Button` uses) won't resolve.
