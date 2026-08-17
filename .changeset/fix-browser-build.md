---
'@jbpark/live-editor': patch
---

Build the package for the browser (`platform: 'browser'` in `tsdown.config`). Without an explicit browser platform, bundled dependencies resolved their Node conditions — e.g. `nanoid` pulled in `crypto.randomFillSync`, and CJS interop injected `createRequire` from `node:module` — so the published package threw in every browser bundler that consumed it (rspack/webpack reject `node:` scheme imports). This also aligns the emitted extensions with the `exports` map (`.js` / `.d.ts`).
