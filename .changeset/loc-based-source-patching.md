---
'@jbpark/live-editor': patch
---

Preserve the author's formatting when editing a field, by patching source at node offsets instead of regenerating the section

`update`/`bulkUpdate` previously mutated the AST and re-emitted the whole section through `@babel/generator`, so a single field edit reflowed the author's line breaks and indentation — including the multi-line `data-binding` declaration that drives the edit. They now record the exact source spans to change and patch the original text, leaving every untouched byte identical.

This also removes the `__JSX_<id>__`/`__HTML_<id>__` placeholder mechanism: raw values are written straight into the source, so they no longer have to survive a generate-then-string-replace round trip, and a value containing `$&` or `$$` can no longer be mangled by it.

No public API change — `update`, `bulkUpdate` and `UpdateResult` keep their signatures.
