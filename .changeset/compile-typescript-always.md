---
'@jbpark/live-editor': patch
---

Compile TypeScript that a heuristic used to miss

`compile()` decided between Babel's TypeScript and plain presets with a set of regular expressions. Common TypeScript that matched none of them, such as `document.body!`, `new Map<string, number>()`, `satisfies` or `useState<string | null>(null)`, was compiled as JavaScript and failed. Every document now goes through the TypeScript preset, which accepts plain JavaScript too. The built-in editor's Cmd/Ctrl+S formatting uses Prettier's `babel-ts` parser for the same reason.
