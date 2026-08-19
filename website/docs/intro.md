---
sidebar_position: 1
title: Overview
---

# Live Editor

An interactive editor for building UIs with real-time preview and
drag-and-drop. Canvas edits sync back to source code via AST transforms, and
the preview renders inside an isolated iframe (or shadow DOM) for DOM/CSS
isolation.

## Install

`@jbpark/ui-kit` is a regular dependency and gets installed automatically.
`prettier`, `react`, and `react-dom` are peer dependencies — required, but
not auto-installed by every package manager (npm 7+ does; pnpm and yarn
don't by default):

```bash
npm install @jbpark/live-editor prettier react react-dom
```

Import the stylesheet once, near your app root:

```ts
import '@jbpark/live-editor/style.css';
```

## Quick start

`Live` is the provider that holds the shared editing context. Everything else
(`Live.Editor`, `Live.Preview`, `Live.Dnd`) reads from it, so an edit on one
surface flows to the others automatically.

```tsx
import { useState } from 'react';

import Live from '@jbpark/live-editor';

const SAMPLE = `
import * as ui from 'ui-kit';

const App = () => (
  <div className="p-6 space-y-2">
    <ui.Typography.Title level={3}>Hello</ui.Typography.Title>
    <ui.Button type="primary">Edit me</ui.Button>
  </div>
);

export default App;
`;

export default function Example() {
  const [code, setCode] = useState(SAMPLE);

  return (
    <Live>
      <Live.Editor value={code} onChange={setCode} />
      <Live.Preview showError frame={{ mode: 'iframe', syncStyle: true }} />
    </Live>
  );
}
```

## How Tailwind reaches the preview

Every sample on this site uses Tailwind utility classes
(`className="p-6 space-y-2"`), and none of them work for free — the code a
reader types is compiled and rendered at runtime, so there's no build step
that could have generated CSS for classes that don't exist yet when the app
first loads. There are two ways to make them actually apply:

**`dynamicTailwind` (simplest)** — pass it to `Live.Preview` and it scans the
current code for `className`/`cn(...)` usages, compiles just those utilities
with the real `tailwindcss` engine, and injects the result as a `<style>` tag
next to the rendered output. Works with or without `frame`:

```tsx
<Live.Preview dynamicTailwind frame={{ mode: 'iframe' }} />
```

**`frame.scripts` + a Tailwind runtime (what this site's own demos use)** —
load a standalone Tailwind runtime script into the iframe via `frame.scripts`
so the iframe's own document processes its own classes live:

```tsx
<Live.Preview
  frame={{
    mode: 'iframe',
    syncStyle: true,
    scripts: ['/path/to/tailwindcss-runtime.js'],
  }}
/>
```

`frame.syncStyle` alone does **not** do this — it only copies the host page's
_already-compiled_ stylesheet into the iframe, which by definition can't
contain utilities that only appear in code the reader types at runtime.
`scripts`/`dynamicTailwind` are unrelated to and unaffected by `syncStyle`.

Neither approach works under `frame.mode: 'shadow'` — see
[Preview Modes](./preview-modes.mdx) for what does and doesn't apply there.

## Props reference

### `Live.Preview`

| Prop              | Type                                  | Description                                                                                                                                                                                                                                                                |
| ----------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code`            | `string?`                             | Explicit code to compile and render. Omit it to render whatever's in `Live`'s shared context instead (the usual `Live.Editor` + `Live.Preview` pairing).                                                                                                                   |
| `showError`       | `boolean?`                            | Show compile/runtime errors inline instead of failing silently.                                                                                                                                                                                                            |
| `frame`           | `boolean \| FrameProps?`              | Isolation strategy — see [Preview Modes](./preview-modes.mdx).                                                                                                                                                                                                             |
| `dynamicTailwind` | `boolean?`                            | Generate Tailwind CSS for the current code at runtime — see [How Tailwind reaches the preview](#how-tailwind-reaches-the-preview) above.                                                                                                                                   |
| `modules`         | `Record<string, unknown>?`            | Extra specifiers resolvable from compiled code's `import` statements, merged with the built-in `baseModules`. Every sample's `import * as ui from 'ui-kit'` resolves through `baseModules` — pass your own map here to make additional specifiers resolvable the same way. |
| `props`           | `Record<string, unknown>?`            | Props forwarded to the compiled code's default-exported component.                                                                                                                                                                                                         |
| `provider`        | `(children: ReactNode) => ReactNode?` | Wrap the rendered output in your own context providers.                                                                                                                                                                                                                    |
| `container`       | `HTMLElement \| null?`                | Currently unused — reserved for future use, has no effect today.                                                                                                                                                                                                           |

### `Live.Editor`

| Prop              | Type                                        | Description                                                                                                                                                                            |
| ----------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`           | `string`                                    | Current code (controlled).                                                                                                                                                             |
| `onChange`        | `(value: string) => void?`                  | Called on every edit.                                                                                                                                                                  |
| `defaultValue`    | `string?`                                   | Falls back to this (or a built-in template) when `value` is empty.                                                                                                                     |
| `debounce`        | `number?`                                   | Milliseconds to wait after the last keystroke before pushing to the shared preview code. Default `1000` — a full second of lag is expected, not a bug. Pass `0` for immediate updates. |
| `height`          | `string?`                                   | Editor height (CSS value).                                                                                                                                                             |
| `theme`           | `Extension \| 'light' \| 'dark' \| 'none'?` | CodeMirror theme — a preset name or your own CodeMirror `Extension`.                                                                                                                   |
| `prettierOptions` | `Record<string, unknown>?`                  | Overrides for the built-in prettier config used on save.                                                                                                                               |
| `fragment`        | `boolean?`                                  | Format the code as a JSX fragment (`<>...</>`) before/after prettier — for editing a snippet that has no single root element, rather than a whole component.                           |
| `raw`             | `boolean?`                                  | Skip prettier formatting on save entirely; commit the value verbatim.                                                                                                                  |
| `renderEditor`    | `(data: EditorRenderData) => ReactNode?`    | Replace the built-in CodeMirror surface — see [Custom Editor](./custom-editor.mdx).                                                                                                    |

### Other exports

- **`Live.Error`** (`LiveError`) — the error display component `Live.Preview`'s `showError` renders compile/runtime errors through internally (`title`, `message`, `onReset` props). Exposed in case you want to render the same error UI yourself. (Unrelated to `renderPanel`'s own edit-validation errors, which surface through a `ui-kit` `Toast` instead.)
- **`LiveRenderer`** — an alias of `Live.Preview`/`LivePreview`, same component, same props.
- **`LiveProvider`** — the named export for what `Live` itself is (the shared-context provider). `import Live from '@jbpark/live-editor'` and `import { LiveProvider } from '@jbpark/live-editor'` are the same component.

### Types

`PaletteRenderData`, `PanelRenderData`, `PanelBinding`, `EditorRenderData`,
`FrameProps`, and `Section` are all importable from the package root:

```ts
import type { PanelRenderData, Section } from '@jbpark/live-editor';
```

`BindingType`/`BindingOption` live under a subpath instead — see
[Custom Palette & Panel](./custom-palette-panel.mdx#panelbinding).

## Features

| Page                                                 | What it covers                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| [Editor Mode](./editor-mode.mdx)                     | A code editor with a real-time preview, synced via AST transforms.    |
| [Custom Editor](./custom-editor.mdx)                 | Replace the built-in CodeMirror editor with your own editing surface. |
| [Drag & Drop](./drag-and-drop.mdx)                   | Build UIs visually by dragging components onto a canvas.              |
| [Custom Palette & Panel](./custom-palette-panel.mdx) | Replace the built-in palette and property panel with your own markup. |
| [Preview Modes](./preview-modes.mdx)                 | Render the preview inside an isolated iframe or a shadow DOM host.    |

## Links

- [GitHub](https://github.com/pjb0811/live-editor)
- [npm](https://www.npmjs.com/package/@jbpark/live-editor)
