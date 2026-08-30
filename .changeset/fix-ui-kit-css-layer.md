---
'@jbpark/live-editor': patch
---

Fix `@jbpark/ui-kit`'s bundled CSS silently overriding this library's own responsive utility classes (#259).

`src/index.css` pulled in `@jbpark/ui-kit/style.css` as a bare `@import`, which merges the two stylesheets' identically-named `theme`/`base`/`components`/`utilities` cascade layers into one. Since ui-kit's own compiled CSS is itself a full Tailwind build, any utility class both stylesheets emit (nearly all of them, since ui-kit uses the same Tailwind utility set) resolved by import order instead of by the responsive variant actually intended to win — most visibly, `hidden md:block` (used for the built-in `Live.Dnd` panel's desktop layout) stayed hidden at any width, because ui-kit's own unconditional `.hidden` landed after `md:block` in the merged layer.

`@import '@jbpark/ui-kit/style.css' layer(ui-kit);`, with `ui-kit` declared between `components` and `utilities` in the layer order, nests ui-kit's own layers under a dedicated `ui-kit` layer instead of merging them into this library's own. This library's own utility classes now always win over ui-kit's identically-named ones, regardless of import order, while ui-kit's internal cascade stays internally consistent.
