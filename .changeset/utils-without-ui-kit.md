---
'@jbpark/live-editor': major
---

Make `@jbpark/live-editor/utils`, `/provider` and `/error` importable outside a
bundler. `./utils` imported `@jbpark/ui-kit` at module scope to build
`baseModules`, and evaluating the UI kit reaches its stylesheet imports, so
importing any of these entries in Node (SSR, build scripts, tests) threw
`Unknown file extension ".css"`.

**Breaking:** `baseModules` moved from `@jbpark/live-editor/utils` to
`@jbpark/live-editor/preview`, next to the preview that uses it. Update the
import if you read it directly:

```ts
import { baseModules } from '@jbpark/live-editor/preview';
```

Compiled samples resolve `'ui-kit'` and `'ui-kit/utils'` exactly as before.
