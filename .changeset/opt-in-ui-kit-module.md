---
'@jbpark/live-editor': major
---

Compiled code no longer imports `@jbpark/ui-kit` by default, and the default palette and new documents no longer use it.

- `import * as ui from 'ui-kit'` and `ui-kit/utils` resolve only when you pass `uiKitModules` from `@jbpark/live-editor/ui-kit` as `modules`, to `Live.Dnd`, `Live.Preview` or `compile()`. `baseModules` is removed from `@jbpark/live-editor/preview`.
- `createDocument()` returns a document without the `ui` and `cn` imports. `createUiKitDocument()` from `@jbpark/live-editor/ui-kit` returns one with them.
- The default palette's sections are rewritten with plain elements and Tailwind classes, under the same ids and names. FAQ, Stats and Roadmap now list their entries as child elements (a Children binding) instead of a component's `items` or `data` array. The previous sections are `uiKitPaletteSections` from `@jbpark/live-editor/ui-kit`.

To keep the previous setup:

```tsx
import {
  createUiKitDocument,
  uiKitFields,
  uiKitModules,
  uiKitPaletteSections,
} from '@jbpark/live-editor/ui-kit';

const [value, setValue] = useState(createUiKitDocument);

<Live.Dnd
  value={value}
  onChange={setValue}
  items={uiKitPaletteSections}
  modules={uiKitModules}
  renderField={uiKitFields}
/>;
```

Pass `modules={uiKitModules}` to `Live.Preview` too when its code imports `ui-kit`.
