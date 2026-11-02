---
'@jbpark/live-editor': major
---

Ship ui-kit's stylesheet with the opt-in ui-kit entry, and make `@jbpark/ui-kit` an optional peer dependency

- `@jbpark/live-editor/style.css` no longer contains `@jbpark/ui-kit`'s stylesheet. It holds only the editor's own styles now, about 23 KB instead of about 146 KB.
- ui-kit's stylesheet is now `@jbpark/live-editor/ui-kit/style.css`, in its own `ui-kit` cascade layer below the editor's styles.
- `@jbpark/ui-kit` moves from `dependencies` to an optional peer dependency. The editor no longer installs or imports it; only `@jbpark/live-editor/ui-kit` uses it.
- `@codemirror/merge` is no longer a dependency.

If you use `@jbpark/live-editor/ui-kit` (`uiKitFields`, `uiKitModules`, `uiKitPaletteSections` or `createUiKitDocument`), install ui-kit and import its stylesheet next to the editor's:

```bash
npm install @jbpark/ui-kit
```

```ts
import '@jbpark/live-editor/style.css';
import '@jbpark/live-editor/ui-kit/style.css';
```

If your own app uses ui-kit components and relied on the editor's stylesheet for their styles, import `@jbpark/live-editor/ui-kit/style.css` or `@jbpark/ui-kit/style.css` yourself.
