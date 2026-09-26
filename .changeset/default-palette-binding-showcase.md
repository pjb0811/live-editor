---
'@jbpark/live-editor': patch
---

Make the default palette exercise every binding option the library supports.
Hero's background style is now an `object` binding with a typed `color` key,
its button gains a `jsx` icon field, and its variant options include the
`solid` value the button actually uses. Stats exposes its marquee speed (with
the bare-string `widget` form) and a `boolean` pause-on-hover toggle. A new
Roadmap section shows an `array` binding whose render-map leaves use labels,
options, constraints, widgets, an `object` leaf with its own render map, and
consumer metadata, alongside top-level `date` and `url` fields.

Also fix nested keys of an object value in the built-in panel being headed by
the raw key instead of the render-map leaf's `label`.
