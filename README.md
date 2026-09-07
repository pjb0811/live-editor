# Live Editor

[English](./README.md) | [한국어](./README.ko.md)

An interactive editor for building UIs with real-time preview and drag‑and‑drop. Canvas edits are synced back to source code via AST transforms, and the result renders inside an iframe for DOM/CSS isolation. Built with React 19 and TypeScript. See [Security Notes](#-security-notes) — the iframe is not a security sandbox.

📖 **Documentation & live demos:** https://live-editor-lab.vercel.app

## 📁 Project Structure

```text
live-editor/
├─ src/
│  ├─ components/
│  │  ├─ context/            # Global state management
│  │  ├─ dnd/                # Drag-and-drop system with editing panels
│  │  │  └─ panel/           # Property panel field editors
│  │  ├─ editor/             # CodeMirror code editor
│  │  ├─ error/             # Error boundary
│  │  ├─ frame/             # iframe/shadow-DOM preview isolation
│  │  └─ preview/           # Isolated preview runtime
│  ├─ pages/
│  │  └─ editor/            # Local development editor (editor + DnD toggle)
│  ├─ utils/
│  │  ├─ ast/               # AST manipulation & code generation
│  │  ├─ tailwind/          # Tailwind theme helpers
│  │  ├─ cache.ts           # Bounded LRU cache
│  │  └─ selection.ts       # Multi-select helpers
│  ├─ constants/            # Constants and configurations
│  ├─ types/                # TypeScript type definitions
│  └─ main.tsx              # Local development app entry
├─ demos/                   # Standalone iframe demos for the documentation
├─ website/                 # Docusaurus documentation site
└─ package.json
```

## 🎯 Highlights

- **Real-time code updates**: Canvas interactions (add/move/remove, property edits) are propagated back to source code safely.
- **Interactive property panel**: Edit numbers, strings, booleans, arrays, and objects from the side panel.
- **Advanced JSX binding system**: Automatically detects and enables editing for all JSX element properties (children, label, icon, etc.) through type-based detection.
- **Smart Items editor**: Manage array items with add/move/delete operations, edit properties and nested JSX components with stable component identity across reorders.
- **Preview runtime**: Renders compiled output inside an iframe for DOM/CSS isolation (not a security sandbox — see [Security Notes](#-security-notes)).
- **Robust drag-and-drop**: Powered by `@dnd-kit` for smooth sorting and positioning.

## 📦 Installation

```bash
pnpm add @jbpark/live-editor react react-dom
```

`react` and `react-dom` (>= 19) are peer dependencies. `prettier` (>= 3) is an
optional peer — install it too if you want the editor's format-on-save; without
it the editor still works and simply skips formatting.

## 🧑‍💻 Usage

Import the stylesheet once near your app root — it is **required** and is not
imported by the JS entry:

```tsx
import { useState } from 'react';

import Live from '@jbpark/live-editor';
import '@jbpark/live-editor/style.css';

// required — not imported by the JS entry

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

See the [documentation site](https://live-editor-lab.vercel.app) for the full
guide (how Tailwind reaches the preview, custom panels, and more).

## 🧩 Entry points

The package ships subpath exports so a consumer who needs only one feature area
can avoid pulling in the rest (e.g. no CodeMirror in a preview-only build) — see
[#194](https://github.com/pjb0811/live-editor/issues/194):

| Import                               | Contains                                    |
| ------------------------------------ | ------------------------------------------- |
| `@jbpark/live-editor`                | Everything (`Live` provider + all surfaces) |
| `@jbpark/live-editor/provider`       | The shared editing context provider only    |
| `@jbpark/live-editor/dnd`            | Drag-and-drop canvas + property panel       |
| `@jbpark/live-editor/editor`         | CodeMirror code editor                      |
| `@jbpark/live-editor/preview`        | Isolated preview runtime                    |
| `@jbpark/live-editor/error`          | Error boundary                              |
| `@jbpark/live-editor/utils`          | Compile/section helpers                     |
| `@jbpark/live-editor/utils/ast`      | AST manipulation & code generation          |
| `@jbpark/live-editor/utils/tailwind` | Tailwind theme helpers                      |
| `@jbpark/live-editor/style.css`      | Compiled stylesheet (required)              |

## 🔒 Security Notes

- The `sandbox` prop on the preview `<iframe>` (`src/components/frame/iframe.tsx`) is **not a security boundary**. Compiled preview code is executed via `new Function(...)` in the host page's own JS realm (`compileModule` in `src/utils/index.ts`); only the resulting React elements are portaled into the iframe's `contentDocument` for DOM/CSS rendering. The iframe itself never evaluates user code.
- Practical implication: previewed code runs with the same JS-level access as the host application (cookies, DOM, in-memory state) — the iframe boundary does not contain it.
- Only open/edit projects you trust. Don't use this editor to preview arbitrary third-party project files without adding real isolation yourself (e.g. running compilation inside the iframe's own `contentWindow` realm and communicating results back via `postMessage`) — that isolation is not implemented here today.

## 🧰 Tech Stack

- **Core**: React 19, TypeScript 6, Vite 8
- **DnD**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`
- **Editor**: `@uiw/react-codemirror` with VSCode theme
- **UI/Styling**: `@jbpark/ui-kit`, `lucide-react`, Tailwind CSS 4
- **Transform**: Babel (standalone) for in-browser transforms

## ⚙️ Requirements

- Peer deps: `react >=19`, `react-dom >=19`
- Node.js: 20.x or higher
- **pnpm**: 10.x or higher (managed via [Corepack](https://nodejs.org/api/corepack.html))

## 🚀 Development (this repo)

> Working on Live Editor itself. To _use_ the package in your app, see
> [Installation](#-installation) above.

### pnpm Setup (Recommended)

This project uses **pnpm@10** with [Corepack](https://nodejs.org/api/corepack.html) for reproducibility. Enable Corepack and activate the specified pnpm version:

```bash
corepack enable
corepack prepare pnpm@10.29.3 --activate
```

Or, if you prefer a manual install:

```bash
npm install -g pnpm@10
```

### Install

```bash
pnpm install
```

### Develop

```bash
pnpm run dev
```

This starts the local editor at the root route. The public documentation and
feature demos live in `website/`.

### Build

```bash
pnpm run build
```

### Test

```bash
pnpm test
```

### Lint & Type Check

```bash
pnpm run lint
pnpm exec tsc -b
```

### Preview Production Build

```bash
pnpm run preview
```

## 📦 Versioning & Release

Releases are fully automated via [changesets](https://github.com/changesets/changesets):

- Each PR against `main` gets an AI-drafted changeset file describing its change.
- Once changesets accumulate on `main`, a "Version Packages" PR bumps `package.json`'s version and consolidates `CHANGELOG.md`.
- Merging that PR builds, tags the release, and publishes to npm.

CI workflows:

- `changeset-draft.yml`: Drafts an AI-generated changeset on PR open/sync against `main`.
- `version.yml`: Opens/updates the "Version Packages" PR once changesets accumulate.
- `publish.yml`: Builds/publishes/tags/creates the GitHub Release on merge to `main` when the version is untagged.
- `release.yml`: Manual `workflow_dispatch` fallback to (re)create a GitHub Release for an existing tag.
- The Docusaurus documentation site is built from `website/` and deployed via
  Vercel (see `vercel.json`).

## 📄 License

[MIT License](./LICENSE) — Copyright (c) 2026 jbpark
