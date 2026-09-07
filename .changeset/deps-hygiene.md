---
'@jbpark/live-editor': patch
---

Trim published dependencies: drop the unused `uuid` runtime dependency and move
the build-time `@tailwindcss/vite` plugin to devDependencies. Neither is
imported from `src/`, so consumers no longer install them.
