# Live Editor

[English](./README.md) | [한국어](./README.ko.md)

An interactive editor for building UIs with real-time preview and drag‑and‑drop. Canvas edits are synced back to source code via AST transforms, and the result renders inside an iframe for DOM/CSS isolation. Built with React 19 and TypeScript. See [Security Notes](#-security-notes) — the iframe is not a security sandbox.

📖 **Documentation & live demos:** https://live-editor.vercel.app

## 📁 Project Structure

```text
live-editor/
├─ src/
│  ├─ components/
│  │  ├─ Context/           # Global state management
│  │  ├─ Dnd/               # Drag-and-drop system with editing panels
│  │  ├─ Editor/             # Code editor
│  │  ├─ Error/              # Error boundary
│  │  ├─ Frame/              # iframe/shadow-DOM preview isolation
│  │  └─ Preview/            # Isolated preview runtime
│  ├─ pages/
│  │  └─ Editor/              # Local development editor (editor + DnD toggle)
│  ├─ utils/ast/             # AST manipulation & code generation
│  ├─ constants/             # Constants and configurations
│  ├─ types/                 # TypeScript type definitions
│  └─ main.tsx                # Local development app entry
├─ demos/                     # Standalone iframe demos for the documentation
├─ website/                   # Docusaurus documentation site
└─ package.json
```

## 🎯 Highlights

- **Real-time code updates**: Canvas interactions (add/move/remove, property edits) are propagated back to source code safely.
- **Interactive property panel**: Edit numbers, strings, booleans, arrays, and objects from the side panel.
- **Advanced JSX binding system**: Automatically detects and enables editing for all JSX element properties (children, label, icon, etc.) through type-based detection.
- **Smart Items editor**: Manage array items with add/move/delete operations, edit properties and nested JSX components with stable component identity across reorders.
- **Preview runtime**: Renders compiled output inside an iframe for DOM/CSS isolation (not a security sandbox — see [Security Notes](#-security-notes)).
- **Robust drag-and-drop**: Powered by `@dnd-kit` for smooth sorting and positioning.

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

## 🚀 Getting Started

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
- Merging that PR builds, tags the release, and (once this package is made public) publishes to npm.

CI workflows:

- `changeset-draft.yml`: Drafts an AI-generated changeset on PR open/sync against `main`.
- `version.yml`: Opens/updates the "Version Packages" PR once changesets accumulate.
- `publish.yml`: Builds/(publishes if public)/tags/creates the GitHub Release on merge to `main` when the version is untagged.
- `release.yml`: Manual `workflow_dispatch` fallback to (re)create a GitHub Release for an existing tag.
- The Docusaurus documentation site is built from `website/` and deployed via
  Vercel (see `vercel.json`).

## 📄 License

MIT License
