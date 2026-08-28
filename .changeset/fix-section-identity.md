---
'@jbpark/live-editor': patch
---

Give sections a real identity so the DnD canvas stops losing track of them (#245).

`Section.id` was modelled two incompatible ways at once. `getSections`
re-derived it from the section's _position_ on every parse, while `Dnd` minted
`uuidv4()` ids for sections it added or copied. A uuid was never written into
the document, so it ceased to exist at the next parse: right after copying a
section, `selectedId` resolved to nothing and the property panel dropped back
to "Please select a section." Positional ids have the same flaw more generally
— any insert, delete, copy or move silently re-points every id at or after the
edit, which is why `moveSection` carried a hand-rolled `setSelectedId(String(targetIndex))`
correction.

- Sections now identify themselves with `data-id`, the same attribute editable
  elements already use. `getSections` reads it and falls back to the positional
  id for documents authored before this, so existing code keeps working
  unchanged until an edit fills the ids in.
- New `fillSectionIds()` splices `data-id` into any top-level `<section>`
  missing one, editing the original source rather than regenerating it so the
  author's formatting is untouched everywhere else.
- Copying a section now selects the copy, because `replaceIds` refreshes the
  section's own `data-id` too and the new id is read back from the committed
  document instead of invented.
- Selection now survives adding, moving and reordering sections, and deleting
  a section no longer clears the selection unless it was the one deleted.
- The `moveSection` index-arithmetic workaround is gone.

Internally, the `replaceSections -> onChange -> setCode` commit sequence — which
was written out seven separate times in `dnd.tsx` — is now a single
`useSectionDocument` hook, taking `dnd.tsx` from 704 to 558 lines and making the
section logic testable without rendering dnd-kit.

No public API change.
