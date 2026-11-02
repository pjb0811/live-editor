---
'@jbpark/live-editor': major
---

Style the editor's own UI with CSS Modules and `--live-editor-*` custom properties

- The palette, canvas and panel no longer use Tailwind classes or the simple ui-kit components (`Button`, `Card`, `Checkbox`, `Space`, `Typography`). They render plain markup styled by CSS Modules in the `components` cascade layer.
- `@jbpark/live-editor/style.css` no longer contains an uncompiled `@tailwind utilities;` line or Tailwind's theme variables. Preview code that uses Tailwind classes gets them from your own Tailwind build or from `dynamicTailwind`, as before.
- Restyle the editor by setting `--live-editor-*` properties (colors, font sizes, radii) on `:root` or an ancestor of the editor. Dark values apply under `[data-theme="dark"]` or `.dark`.
- A `className` on `Live.Dnd.Palette`, `Canvas`, `Panel` or `Live.Dnd` still overrides the region's own styles when it is a Tailwind utility or an unlayered rule. It is no longer merged with `tailwind-merge`, so a rule in a cascade layer declared before `components` loses to the region's styles.
- The row and "Select all" checkboxes in the Items and Children editors are native `<input type="checkbox">` elements. Code that read their state from `aria-checked` should read `checked` and `indeterminate` instead.
