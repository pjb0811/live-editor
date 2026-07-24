# Live Editor

[English](./README.md) | [한국어](./README.ko.md)

An interactive editor for building UIs with real-time preview and drag‑and‑drop. Canvas edits are synced back to source code via AST transforms, and the result runs safely in an isolated iframe sandbox. Built with React 19 and TypeScript.

## 📁 Project Structure

```text
live-editor/
├─ src/
│  ├─ components/
│  │  ├─ Context/           # Global state management
│  │  ├─ Dnd/               # Drag-and-drop system with editing panels
│  │  ├─ Editor/            # Code editor
│  │  ├─ Error/             # Error boundary
│  │  └─ Preview/           # Isolated preview runtime
│  ├─ pages/
│  │  ├─ Playground/        # Main editor page
│  │  └─ Preview/           # Full-screen preview page
│  ├─ utils/ast/            # AST manipulation & code generation
│  ├─ enums/                # Constants and configurations
│  ├─ types/                # TypeScript type definitions
│  └─ App.tsx               # App layout with routing
└─ package.json
```

## 🎯 Highlights

- **Real-time code updates**: Canvas interactions (add/move/remove, property edits) are propagated back to source code safely.
- **Interactive property panel**: Edit numbers, strings, booleans, arrays, and objects from the side panel.
- **Advanced JSX binding system**: Automatically detects and enables editing for all JSX element properties (children, label, icon, etc.) through type-based detection.
- **Smart Items editor**: Manage array items with add/move/delete operations, edit properties and nested JSX components with stable component identity across reorders.
- **Isolated preview runtime**: Runs user code in a sandboxed iframe to keep the main app safe.
- **Robust drag-and-drop**: Powered by `@dnd-kit` for smooth sorting and positioning.
- **Save & Preview**: Save your code to localStorage and view it in a dedicated full-screen preview page (`/preview`).

## 🧰 Tech Stack

- **Core**: React 19, TypeScript 5.8, Vite 7
- **Routing**: `react-router-dom` for SPA navigation
- **DnD**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`
- **Editor**: `@uiw/react-codemirror` with VSCode theme
- **UI/Styling**: Ant Design, Tailwind CSS 4
- **Transform**: Babel (standalone) for in-browser transforms

## ⚙️ Requirements

- Peer deps: `react >=19`, `react-dom >=19`
- Node.js: 20.x or higher
- **pnpm**: 9.x or higher (managed via [Corepack](https://nodejs.org/api/corepack.html))

## 🚀 Getting Started

### pnpm Setup (Recommended)

This project uses **pnpm@9** with [Corepack](https://nodejs.org/api/corepack.html) for reproducibility. Enable Corepack and activate the specified pnpm version:

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

Or, if you prefer a manual install:

```bash
npm install -g pnpm@9
```

### Install

```bash
pnpm install
```

### Develop

```bash
pnpm run dev
```

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
- `docs-deploy.yml`: Builds and deploys `dist/` to GitHub Pages.

Note: For GitHub Pages, set the repository Pages source to “GitHub Actions”. If deploying under a repo subpath, configure `base` in `vite.config.ts` accordingly.

## 📄 License

MIT License
