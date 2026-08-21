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

`@jbpark/ui-kit` and `prettier` (used internally for the editor's Cmd+S
formatting) are regular dependencies and get installed automatically.
`react` and `react-dom` are peer dependencies — required, but not
auto-installed by every package manager (npm 7+ does; pnpm and yarn don't by
default):

```bash
npm install @jbpark/live-editor react react-dom
```

Import the stylesheet once, near your app root:

```ts
import '@jbpark/live-editor/style.css';
```

### Smaller bundles with subpath imports

`import Live from '@jbpark/live-editor'` pulls in every feature area (Dnd,
Editor, Preview) whether you use it or not. If you only need one, import it
from its own subpath instead:

```ts
import Dnd from '@jbpark/live-editor/dnd';
import Editor from '@jbpark/live-editor/editor';
import LiveError from '@jbpark/live-editor/error';
import Preview from '@jbpark/live-editor/preview';
import { ContextProvider } from '@jbpark/live-editor/provider';
```

`./preview` and `./editor` genuinely shrink what gets bundled (no CodeMirror
in a preview-only build, no `@dnd-kit` in an editor-only one). `./dnd` is the
exception: its property panel reuses the editor's own CodeMirror `Core` and
`prettier`-based formatting internally for `jsx`/`richtext` field editing, so
CodeMirror/prettier come along with `./dnd` too — that's a real dependency of
the feature, not something this subpath split was able to remove.

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
first loads. There are three ways to make them actually apply, and the first
two are complementary — use both together to cover each other's gaps.

**`syncStyle`** — clones the host document's already-compiled
`<link>`/`<style>` tags in (into the iframe document, or directly into the
shadow root — works under both `frame.mode`s):

```tsx
<Live.Preview frame={{ mode: 'shadow', syncStyle: true }} />
```

Since it's copying real, already-built CSS, it includes anything a
consuming app's own build knew about — including custom theme tokens (e.g.
ui-kit's `Button` rendering `bg-primary`, backed by a project-specific
`--primary` token that Tailwind's own default theme has no idea exists). Its
limitation is the mirror image: it can't include a utility class that only
appears in code typed at runtime, since by definition no build ever saw it
to compile CSS for it.

**`dynamicTailwind`** — pass it to `Live.Preview` and it scans the
_rendered DOM_ after mount, compiles whatever classes actually ended up on
the page with the real `tailwindcss` engine, and injects the result as a
`<style>` tag next to the rendered output. Scanning the DOM rather than the
source text means it also picks up classes contributed by an imported
component, not just literal `className`/`cn(...)` usage in the code the
reader typed. Works with or without `frame`, and under either `frame.mode`:

```tsx
<Live.Preview dynamicTailwind frame={{ mode: 'shadow' }} />
```

Its limitation is the mirror image of `syncStyle`'s: it only knows
Tailwind's own default theme (colors, spacing, font sizes, ...), not a
consuming app's custom theme extensions, since it recompiles from scratch
rather than reusing anything the host already built.

**`frame.scripts` + a Tailwind runtime (`iframe` mode only)** — load a
standalone Tailwind runtime script into the iframe via `frame.scripts` so the
iframe's own document processes its own classes live:

```tsx
<Live.Preview
  frame={{
    mode: 'iframe',
    syncStyle: true,
    scripts: ['/path/to/tailwindcss-runtime.js'],
  }}
/>
```

`scripts` doesn't apply under `frame.mode: 'shadow'` at all (there's no
separate document to load it into) — see [Preview Modes](./preview-modes.mdx)
for what does and doesn't apply there.

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
