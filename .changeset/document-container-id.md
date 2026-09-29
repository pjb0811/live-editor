---
'@jbpark/live-editor': minor
---

Let `Live.Dnd` work with a document built around any container id, and say so when the container is missing. A document's sections are the `<section>` elements inside the element with `id="app-container"`. That id was fixed, and a document without it (including an empty string) had no sections: everything added from the palette was silently dropped.

- `Live.Dnd` takes a `containerId` prop, which defaults to `app-container`.
- When the document has no element with that id, `Live.Dnd` reports it once through `onEditError`, or a toast by default. The error is a new `DndEditError` shape: `{ type: 'parse', target: 'document', reason: 'container-not-found', containerId }`. The empty canvas names the missing id too.
- New `createDocument({ containerId? })` in `@jbpark/live-editor/utils` returns an empty document `Live.Dnd` can add sections to. Start a controlled `Live.Dnd` from it rather than from `''`.
- `extractSections`, `replaceSections`, `generateSection` and `generateSections` in `@jbpark/live-editor/utils` take an optional `{ containerId }` as a last argument. So do `parseDocument`, `replaceDocumentSections`, `generateSectionPreview(s)`, `fillSectionIds` and `createSectionPreviewCache().compute` in `@jbpark/live-editor/utils/ast`.
- New `inspectDocument(code, options?)` in `@jbpark/live-editor/utils/ast` works like `parseDocument` but says why a source isn't a usable document: `'parse-error'` or `'container-not-found'`.
- New exported types: `DocumentOptions`, from both entries; `DocumentInspection` and `DocumentProblem`, from `utils/ast`.

Existing documents that use `app-container` behave as before. The Drag & Drop guide has a new "Document structure" section, and its examples start from `createDocument()`.
