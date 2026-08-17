---
'@jbpark/live-editor': patch
---

Fix the package `exports`, `module`, and `types` fields to point at the files the build actually emits. They still referenced a pre-`tsdown` layout (`./dist/index.js`, `./dist/utils.js`, `./dist/live-editor.css`, `.d.ts`), and while the entry names were corrected, the extensions must match what `tsdown` emits under `platform: 'browser'` — `./dist/index.js`, per-entry `./dist/utils/index.js` / `./dist/utils/ast/index.js` / `./dist/utils/tailwind/index.js`, `./dist/style.css`, and `.d.ts` declarations. As a result, importing the package by name (`@jbpark/live-editor`, `/utils`, `/utils/ast`, `/utils/tailwind`, `/style.css`) failed to resolve for any consumer — the in-repo Vite demo only worked because it imports via the `~/.` source alias, sidestepping the package entry entirely. All five export subpaths now resolve against the real build output.
