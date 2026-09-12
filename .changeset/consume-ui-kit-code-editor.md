---
'@jbpark/live-editor': patch
---

Consume `@jbpark/ui-kit`'s `CodeEditor` instead of a local CodeMirror surface

The CodeMirror wiring (editor component, JS/TS + line-wrap extensions, the
Cmd+S save transaction and the unified diff view) now comes from
`@jbpark/ui-kit/CodeEditor` (#309, follow-up to ui-kit's #346). live-editor
keeps its own glue — the debounced preview sync, error context, and the
`raw`/`fragment`/`prettierOptions` prettier shaping — so the editor's public
props and behaviour are unchanged.

- `editor/core` is now a thin adapter that maps live-editor's vocabulary onto
  `CodeEditor` (`onError` → `onFormatError`, `raw` skips the injected
  formatter).
- `diff-modal` uses `CodeEditor`'s `diff` prop rather than wiring
  `unifiedMergeView` by hand.
- Bumps `@jbpark/ui-kit` to `^9.0.0`.
