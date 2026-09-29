---
'@jbpark/live-editor': minor
---

Name sections without a `data-name` in English by default, and let the host choose the name. A `<section>` with no `data-name` used to be named with a fixed Korean label (`1번째 컴포넌트`, ...), whatever the consumer's locale. It's now `Section 1`, `Section 2`, and so on, on the canvas, in the panel, and in `extractSections()`. Pass `sectionNameFallback` to `Live.Dnd` to name them yourself: it gets the section's 0-based position. `extractSections()` from `@jbpark/live-editor/utils` and `getSections()` from `@jbpark/live-editor/utils/ast` take the same option as an optional second argument, and the `SectionOptions` type is exported from both entries. Sections that have a `data-name` are unaffected.
