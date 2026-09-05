---
'@jbpark/live-editor': patch
---

Run the test suite in CI and unblock component-layer tests. `pnpm test` now
gates both `ci.yml` and `publish.yml`, the vitest `include` glob matches
`.test.tsx` so component tests can no longer be silently skipped, and a jsdom
env (opt-in per file) plus Testing Library are available. Backfills tests for
`utils/ast/tree` and `utils/ast/helpers`, and the `usePreview`/`useError`
context guards.
