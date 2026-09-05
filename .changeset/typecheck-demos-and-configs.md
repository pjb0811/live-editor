---
'@jbpark/live-editor': patch
---

Type-check `demos/` and the remaining build configs. `tsconfig.app.json` now
includes `demos` and `tsconfig.node.json` includes `vitest.config.ts`,
`tsdown.config.ts`, and `demos/vite.config.ts`, so `tsc -b` (and CI's type
check) covers them instead of silently skipping ~1k LOC of demo code and three
of the four config files.
