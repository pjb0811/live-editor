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
`prettier`, `typescript`, `react`, and `react-dom` are peer dependencies —
required, but not auto-installed by every package manager (npm 7+ does;
pnpm and yarn don't by default):

```bash
npm install @jbpark/live-editor prettier typescript react react-dom
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
