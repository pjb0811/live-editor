---
'@jbpark/live-editor': major
---

The built-in panel's field controls are now native inputs, selects and text areas, so the panel needs no UI kit to edit fields. The checkbox, select, date, datetime, time and color fields use `<input type="checkbox">`, `<select>`, `<input type="date">`, `<input type="datetime-local">`, `<input type="time">` and `<input type="color">`, and a `richtext` field edits its HTML source in a text area. Labels and validation messages are tied to each control with `for`, `aria-describedby` and `aria-invalid`.

The `@jbpark/ui-kit` controls move to a new `@jbpark/live-editor/ui-kit` entry. To keep the previous date picker, time picker, color picker, rich text editor, select and checkbox, pass its `uiKitFields` as `renderField`:

```tsx
import { uiKitFields } from '@jbpark/live-editor/ui-kit';

<Live.Dnd value={value} onChange={setValue} renderField={uiKitFields} />;
```

If you already pass a `renderField`, return `uiKitFields(props, builtin)` for the fields yours leaves alone.
