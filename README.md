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

## 📦 Versioning & Release (Changesets)

This project uses **Changesets** and GitHub Actions to automate releases.

Manual steps (optional):

1. Create a changeset:
   ```bash
   pnpm changeset
   ```
2. Version packages and update changelog:
   ```bash
   pnpm version-packages
   ```
3. Publish (runs build then publish):
   ```bash
   pnpm release
   ```

CI workflows:

- `publish.yml`: Opens a release PR or publishes to npm via Changesets.
- `release.yml`: Creates GitHub Releases on tag push (e.g., `v1.2.3`).
- `auto-release.yml`: Generates version bump PRs on demand.
- `docs-deploy.yml`: Builds and deploys `dist/` to GitHub Pages.

Note: For GitHub Pages, set the repository Pages source to “GitHub Actions”. If deploying under a repo subpath, configure `base` in `vite.config.ts` accordingly.

## 📄 License

MIT License
