# Architecture

[English](./ARCHITECTURE.md) | [한국어](./ARCHITECTURE.ko.md)

This document is for people changing Live Editor itself. It explains how the
pieces fit together: where the document lives, how it becomes a canvas and a
panel, how an edit finds its way back into the source, and what each word in
the code means. For using the library, see the
[documentation site](https://live-editor-lab.vercel.app); its
[How It Works](./website/docs/how-it-works.mdx) page covers the same model
without file paths.

Read it in order the first time. Each section builds on the vocabulary of the
ones before it.

1. [The one idea](#the-one-idea)
2. [Glossary](#glossary)
3. [Map of the source](#map-of-the-source)
4. [Who owns the document](#who-owns-the-document)
5. [Read path: from code to canvas and panel](#read-path-from-code-to-canvas-and-panel)
6. [Write path: three levels of commit](#write-path-three-levels-of-commit)
7. [Inside `Live.Dnd`](#inside-livednd)
8. [The AST layer](#the-ast-layer)
9. [Compiling and rendering](#compiling-and-rendering)
10. [Errors, messages and caches](#errors-messages-and-caches)
11. [Where to start for common changes](#where-to-start-for-common-changes)
12. [Known rough edges](#known-rough-edges)

## The one idea

**The source code string is the only state that matters.** Everything on
screen is derived from it, and every edit is a change to it.

- The canvas doesn't keep its own tree of components. It re-reads the sections
  out of the code on every change.
- The panel doesn't keep field values. It reads them out of the selected
  section's code.
- An edit doesn't regenerate the code from a model. It finds the exact span of
  source that holds the value and replaces only that span, so formatting,
  comments and unsupported syntax around it survive untouched.

When something on screen looks wrong, the question is almost always "what did
the code say, and how was it read?" rather than "what state got out of sync?".

## Glossary

The same English word means different things in different layers. These are
the meanings the code uses.

### The document

| Term                    | Meaning                                                                                                                                                                            | Where                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Document**            | The whole source string: a module whose default export is a React component (usually `App`). Held as `code` in `PreviewContext`, or as the host's `value`.                         | `components/context/states.ts`                       |
| **Container**           | The element whose `<section>` children are the editable sections. Found by id, `app-container` unless `containerId` says otherwise.                                                | `DEFAULT_CONTAINER_ID` in `constants/index.ts`       |
| **Section**             | One `<section>` directly inside the container. In code it's `Section { id, name, code }`: `id` from its `data-id`, `name` from `data-name` (or a fallback), `code` its JSX source. | `types/index.ts`                                     |
| **Section preview**     | The document with the container holding _only one_ section. Each canvas slot compiles its own preview, so one broken section can't take down the others.                           | `generateSectionPreviews` in `utils/ast/document.ts` |
| **Problem** / **stale** | Why a document can't be read (`parse-error` or `container-not-found`). While it doesn't parse, the canvas and panel show the _last version that did_ and are `stale`: read-only.   | `inspectDocument`, `useSectionDocument`              |

### Elements and bindings

| Term              | Meaning                                                                                                                                                                                                                                                                                                                                                                                           | Where                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **`data-id`**     | An element's identity. It links a DOM element in the preview to its JSX in the source, and is the address every edit uses. Every section gets a unique one (`fillSectionIds`). Inside a section, an empty `data-id=""` is filled deterministically from the section's id (`fillIdsFrom`), so the canvas and the panel agree on it; an element with no `data-id` attribute at all can't be edited. | `utils/ast/tree.ts`                               |
| **Node**          | `DataAttrNode`: one JSX element as `extract()` reads it — tag name, attributes, text, children, and its resolved bindings. Not a DOM node.                                                                                                                                                                                                                                                        | `utils/ast/types.ts`                              |
| **Binding**       | `BindingItem`: a declaration that one _property_ of an element is editable, with a `label`, a `type` and constraints. Comes from the element's `data-binding`, or `data-binding-key` → `bindingKeys`, or the component's entry in `bindings`, in that order.                                                                                                                                      | `resolveBindings` in `utils/ast/binding.ts`       |
| **Property**      | What a binding edits. Either an attribute name (`src`, `title`, `data-size`) or one of four special names: `innerText`, `innerHTML`, `children`, `items`.                                                                                                                                                                                                                                         | `BINDING_PROP` in `constants/index.ts`            |
| **Panel binding** | `PanelBinding`: one binding flattened for the panel, with its current `value`, its source text `rawValue`, and an `onChange` that commits. What `useDndPanel().bindings` returns.                                                                                                                                                                                                                 | `components/dnd/panel-binding.ts`                 |
| **Field**         | The control the panel draws for one panel binding. `getFieldKind` picks which one (text, number, color, Items editor, ...); `renderField` can replace it.                                                                                                                                                                                                                                         | `components/dnd/panel/field.tsx`, `field-kind.ts` |

### "Item" means four things

The public API uses "item" for four different things. Internal code says
"section" for the first and last of them; the public names stay until a
major version.

| Where you see it                                                          | It means                                                                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Live.Dnd`'s `items` prop, `DndPalette.items`, `Live.Dnd.DraggableItem`   | A **palette item**: a section template you drag onto the canvas. Typed `Section`. Internally `PALETTE_SECTIONS`. |
| `BindingItem`                                                             | A **binding** (see above).                                                                                       |
| `useDndItems`, `Items`, `SortableItems`, `items.ts`, the `items` property | An **array item**: one element of an array literal bound to a field.                                             |
| `DndPanel.item`                                                           | The **selected section**.                                                                                        |

### The editor around them

| Term           | Meaning                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Provider**   | `Live` / `ContextProvider`. Holds the document (`PreviewContext`), the last error (`ErrorContext`) and the UI text (`MessagesContext`). Every surface reads from it.           |
| **Region**     | One of `Live.Dnd`'s three areas: palette, canvas, panel. Custom layouts place them; custom palettes and panels read the same data through `useDndPalette()` / `useDndPanel()`. |
| **Commit**     | Writing a new document: to the host's `onChange` and to the provider's `setCode`. Every edit ends in one.                                                                      |
| **Edit error** | `DndEditError`: an edit the editor refused, with a translated `title` and `description`. Goes to `onEditError`, or the built-in toast.                                         |
| **Module**     | What `compile()` returns: `{ exports, error? }`.                                                                                                                               |
| **Frame**      | Where a component renders: an iframe, a shadow root, or in place. For DOM/CSS isolation only, never a security boundary.                                                       |

## Map of the source

```text
src/
├─ index.tsx            The package entry: `Live` and its static members
├─ constants/           DATA_ATTR, BINDING_PROP, templates (mostly template strings)
├─ types/               Section, Module
├─ components/
│  ├─ context/          The provider: document, error, UI text
│  ├─ editor/           Live.Editor — CodeMirror surface, debounced push to the provider
│  ├─ preview/          Live.Preview — compile the whole document and render it
│  ├─ frame/            iframe / shadow / in-place containers, style sync, auto height
│  ├─ error/            Live.Error — error box, React error boundary, window error guard
│  └─ dnd/              Live.Dnd — canvas, panel, palette (see "Inside Live.Dnd")
│     └─ panel/         The built-in panel and its field editors
└─ utils/
   ├─ compile.ts        Babel transform + `new Function`, with an LRU cache
   ├─ sections.ts       Section helpers over the AST layer (extractSections, createDocument, ...)
   ├─ ast/              Reading and editing JSX source (see "The AST layer")
   └─ tailwind/         Tailwind CSS generation for previews
```

Dependencies point one way: `components/*` use `utils/*`, never the reverse.
`utils/` must stay loadable in plain Node, so it never imports the UI kit,
whose stylesheet imports Node can't load. CI checks this
(`check-node-entries`).

## Who owns the document

```text
                 ┌──────────────────────────────┐
                 │  Provider (PreviewContext)   │
                 │  code ── setCode             │
                 └──────────────────────────────┘
                    ▲    │           ▲    │          │
       debounced    │    │ draft     │    │ value    │ code
       push         │    ▼ follows   │    ▼          ▼
                 Live.Editor      Live.Dnd        Live.Preview
                                  commit ──► host onChange (if controlled)
```

- **The provider** holds one `code` string. `setCode` also clears the last
  error in the same update, so a fixed document never shows the old error.
- **`Live.Editor`** keeps a local draft so typing is instant, and pushes it to
  the provider after `debounce` ms (or on blur, save or unmount). When the
  provider changes from somewhere else, an uncontrolled editor's draft follows.
- **`Live.Dnd`** reads `value` if the host passes one (controlled), otherwise
  the provider's `code`. Every commit goes to both the host's `onChange` and
  `setCode`.
- **`Live.Preview`** reads its `code` prop, or the provider's `code`.

So with no `value` anywhere, the three surfaces stay in sync through the
provider alone. With `value`, the host owns the document and the provider is
the channel to the other surfaces.

## Read path: from code to canvas and panel

What happens between a new document string and what's on screen. Everything
here is a pure derivation, recomputed when the code changes and cached where
it's expensive.

```text
document string
  │  fillSectionIds          give every section a unique data-id (not written back yet)
  │  inspectDocument         parses? container found? → ok | problem
  │                          (parse error → keep showing the last version that parsed)
  ▼
extractSections              → Section[] { id, name, code }
  │
  ├─► canvas, per section
  │     createSectionPreviewCache   document with only this section in the container,
  │                                 ids filled with fillIdsFrom(section.code, section.id)
  │     Renderer → useCompiledModule → compile()   Babel + new Function
  │     Frame (iframe / shadow / none) → the section's React tree
  │
  └─► panel, for the selected section
        fillIdsFrom(section.code, section.id)       the same ids the canvas used
        extract(code, bindingOptions)               → DataAttrNode[] with bindings
        resolvePanelBindings                        → PanelBinding[] (value, rawValue)
        withPanelCommit                             + onChange for each
        useDndPanel().bindings → Panel → Field      getFieldKind picks the control
```

Two things make this work:

- **The same id filling on both sides.** The canvas preview and the panel fill
  empty `data-id=""`s the same way, from the section's id and the element's
  position. That's why clicking an element in the preview (the element picker)
  can find its fields before any edit has written the ids into the source.
- **Section previews are separate documents.** Each slot compiles the whole
  document with only its own section inside the container. Imports and helper
  components outside the container still work, an unchanged section produces
  the same string (so `React.memo` skips it), and an error stays in its slot.

Files: `components/dnd/use-section-document.ts` (top half),
`components/dnd/dnd.tsx` (the `fields` memo), `components/dnd/renderer.tsx`,
`components/dnd/panel-binding.ts`, `utils/ast/document.ts`,
`utils/ast/extract.ts`.

## Write path: three levels of commit

An edit always ends as a new document string, but it can start at three
levels. Each level turns its edit into the level above's input.

```text
③ value level        Items / Children editor
   useDndItems         items.ts edits the array literal's source
   useDndChildren      describes the change as a children edit
        │  binding.onChange(new value)
        ▼
② section level      a field, or onNodeChange / onNodesChange
   Dnd.commitChanges   updateAll(section code, changes)
                         update() finds the element by data-id,
                         matches the binding, and returns source spans;
                         applyEdits writes only those spans
        │  patch({ ...section, code })
        ▼
① document level     palette drop, move, copy, delete, reorder, or ② above
   useSectionDocument.commit
                       replaceSections → fillSectionIds
        │
        ▼
   host onChange(next) + provider setCode(next)
```

### ① Document level — `useSectionDocument`

`components/dnd/use-section-document.ts` owns the list of sections and the one
`commit` function that turns a list of section sources back into a document.
Every section operation (`add`, `remove`, `copy`, `move`, `reorder`, `patch`)
is a different list passed to the same `commit`.

- **Refused while stale.** If the document doesn't parse, every operation calls
  `onBlockedEdit` instead of committing: the section ranges it would write into
  belong to the last version that parsed, not the current source.
- **Same-tick commits.** Two commits in the same event both start from the same
  render's document. `pendingRef` remembers the last commit's output so the
  second builds on it instead of overwriting it (#450). `getCommittedSection`
  exposes this to level ②.
- **Ids are written only on commit.** Opening a document never rewrites the
  author's code; filled ids land in the source with the first real edit.

### ② Section level — `Dnd.commitChanges`

In `components/dnd/dnd.tsx`. One panel edit, or several as one commit
(`onNodesChange`), becomes a call to `updateAll` on the selected section's
code. `update()` (`utils/ast/update.ts`):

1. Parses the section and finds the element whose `data-id` matches.
2. Resolves its bindings (the same three sources `extract` used) and finds the
   one matching the `property` (or the `label`).
3. Runs the editor for that property: `innerText`, `innerHTML` (or richtext),
   `children`, or an attribute (edit, add or remove).
4. Each editor returns **source spans** to replace, never a modified tree.
   `applyEdits` (`utils/ast/patch.ts`) writes those spans into the original text.

A refused edit returns an `UpdateFailure` with a `reason`. `describeUpdateFailure`
turns it into the edit error's title and description.

### ③ Value level — Items and Children

Some values have structure of their own. An `items` value is an array literal,
and its rows can be moved, copied, added and removed. A `children` value is
the element's JSX children.

- **`useDndItems`** (`components/dnd/panel/use-dnd-items.ts`) parses the array,
  gives each row a stable identity across edits, and turns each action into an
  edit of the array's source (`utils/ast/items.ts`, `array-source.ts`). The new
  array source goes to the binding's `onChange`, which is level ②.
- **`useDndChildren`** (`components/dnd/panel/use-dnd-children.ts`) describes
  the action (move, duplicate, delete, add) and its targets, and sends that to
  level ② as the `children` property's value. `update()` hands it to
  `editChildrenSource` (`utils/ast/children.ts`), which checks it against the
  current source before applying it.
- **Nested bindings.** JSX inside an array item (`{ label: <b data-id="x" ... /> }`)
  is invisible to the top-level `extract()`, which doesn't walk into attribute
  values. The Items editor re-extracts that JSX and commits its fields through
  `onNodeChange` by `data-id` (#308).

## Inside `Live.Dnd`

`components/dnd/dnd.tsx` is the hub. It holds no document state of its own:
it calls hooks that do, builds three plain data objects, and hands them to the
regions through context.

```text
Dnd (dnd.tsx)
├─ useSectionDocument   sections, previews, selection, document-level commits   (① above)
├─ useDeleteFlow        asks onBeforeDelete, then removes
├─ useDndKeyboard       sensors, keyboard navigation, screen-reader announcements
├─ useInspectorState    the element picker: hover highlight, pick → select + onNodePick
├─ fields memo          extract() of the selected section                         (read path)
├─ commitChanges        section-level commits                                     (② above)
│
├─ palette = { items, onAdd }                     ┐
├─ panel   = { item, bindings, onNodeChange, ... }├─ DndRegionContext → useDndPalette / useDndPanel / useDndLayout
├─ canvas  = <Droppable> + <Sortable> + <Renderer>┘
│
├─ DndEditOptionsContext   renderField, reportError, bindingOptions (read by Field, useDndItems)
├─ DndInspectorContext     the element picker's state (useDndInspector)
├─ SectionFallbackContext  renderSectionFallback
└─ children ?? <Layout />  the built-in Palette / Canvas / Panel arrangement
```

- **Public types live apart from the component.** `DndPanel`, `DndPalette`
  and the props are in `types.ts`; `PanelBinding` and the commit callbacks are
  in `panel-binding.ts`. Files that need a type import it from there, not
  from `dnd.tsx`.
- **Data, not components.** The built-in palette and panel read
  `useDndPalette()` and `useDndPanel()` exactly as a custom one would, so the
  public surface can't fall behind what the built-ins use (#237).
- **Regions are placement only.** `Live.Dnd.Palette`, `Canvas` and `Panel`
  (`layout.tsx`) wrap the region's content in the container it needs. A custom
  layout passes its own `children` and places them anywhere inside the drag
  context.
- **Drag and drop** is `@dnd-kit`. A palette section carries the drag data
  from `palette-drag.ts`, which everything reads with `paletteSectionOf`;
  `onDragEnd` turns it into `add`, and a canvas drag into `reorder`. `overlay.tsx` renders the dragged section.
- **The panel** (`panel/panel.tsx`) groups `bindings` by element and renders a
  `Field` for each. `Field` asks `renderField` first, then falls back to
  `BuiltinField`, which switches on `getFieldKind`.

## The AST layer

`utils/ast/` reads and edits JSX source with `@babel/standalone`. The files
follow the pipeline:

| Stage     | Files                                        | What they do                                                                                                                                    |
| --------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared    | `types.ts`, `helpers.ts`, `jsx-name.ts`      | Types; `wrap`/`unwrap` (parse a JSX fragment as a program and back), `generateCode`; tag names as written                                       |
| Document  | `document.ts`, `tree.ts`                     | Parse the document (cached), find the container and sections, splice section lists back in, build section previews; fill and replace `data-id`s |
| Read      | `extract.ts`, `binding.ts`, `value.ts`       | JSX → `DataAttrNode[]`; resolve and parse bindings; read a literal's value without evaluating code                                              |
| Write     | `update.ts`, `patch.ts`                      | Find the element and binding, produce source spans, apply them                                                                                  |
| Structure | `items.ts`, `array-source.ts`, `children.ts` | Edit array literals and JSX children while keeping everything else byte-identical                                                               |
| Check     | `validate.ts`                                | `validateBindingValue`: required, min/max, pattern, url, date                                                                                   |

Rules every change here follows (also in [the AST skill](./.github/skills/ast/SKILL.md)):

- **Never mutate a shared or cached AST.** Parse results are cached; record
  spans and patch text instead.
- **Edit spans, don't regenerate.** Only the bytes being changed are new.
  Generating a whole element or section again would reformat it and drop
  comments.
- **Refuse rather than guess.** When the source isn't a shape the editor can
  edit safely (a spread, a hole, a computed value), return a failure and leave
  the source alone. The [Editable Syntax](./website/docs/editable-syntax.mdx)
  page lists what's supported.
- **Pair `wrap()` with `unwrap()`** when parsing a JSX fragment, and only there.
- **Import module files, not the barrel.** `utils/ast/index.ts` is the public
  entry, partly deprecated. Library code imports `./update`, `./extract`, and
  so on, which `barrels.test.ts` enforces.

## Compiling and rendering

```text
code ─► compile(code, modules)          utils/compile.ts
          Babel: typescript? + env + react → CommonJS
          new Function(exports, require, module, React)
          require: 'react', 'ui-kit', 'ui-kit/utils', or a key of `modules`
        ─► Module { exports.default: Component } or { error }
        ─► Frame                        components/frame/
             iframe: portal into an iframe document, copy the host's styles,
                     size to content
             shadow: portal into a shadow root
             none:   render in place
        ─► Error.Boundary + Error.Guard around the component
```

- **The code runs in the host page's JavaScript realm.** The iframe only
  receives the rendered elements through a portal. It isolates DOM and CSS, not
  JavaScript. Only run trusted code.
- `compile()` is cached on the code plus the identity of each module, up to 50
  entries. Pass a new `modules` object when a module's implementation changes.
- `Live.Preview` compiles the whole document once (`preview/client.tsx`).
  `Live.Dnd` compiles one section preview per slot (`dnd/renderer.tsx`). Both
  use `useCompiledModule`, which adds the base modules
  (`preview/base-modules.ts`) to the host's `modules`.

## Errors, messages and caches

**Errors** go to different places depending on who can act on them:

| What failed                                     | Shown as                                   | Code                                    |
| ----------------------------------------------- | ------------------------------------------ | --------------------------------------- |
| Compiling the preview                           | Error box, `messages.errors.compile`       | `preview/client.tsx`                    |
| Rendering or an event handler in the preview    | Error box; also `ErrorContext`             | `error/boundary.tsx`, `error/guard.tsx` |
| One canvas section (compile, render, or forced) | That slot only, or `renderSectionFallback` | `dnd/renderer.tsx`                      |
| An edit the editor refused                      | `DndEditError` → `onEditError`, or a toast | `dnd/edit-options.ts`                   |

**UI text** lives in `components/context/messages.ts`. Every visible or
announced string comes from `useLiveMessages()`. A new string needs a key there
and in `src/pages/shared/ko-messages.ts`, which is typed as the full set so a
missing key fails the type check.

**Caches** are bounded and owned by the provider: the compile cache, the
document parse cache, the extract cache and external script blobs. The last
provider to unmount clears them (`utils/editor-caches.ts`).

## Where to start for common changes

| You want to...                                            | Start in                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Support a new authored syntax in a field                  | `utils/ast/update.ts` (write) and `extract.ts` / `value.ts` (read); then the Editable Syntax page |
| Add a binding `type` or change which control a field gets | `BINDING_TYPES` in `utils/ast/types.ts`, `panel/field-kind.ts`, `panel/field.tsx`                 |
| Change what a section operation does                      | `dnd/use-section-document.ts`                                                                     |
| Change how panel edits commit                             | `commitChanges` in `dnd/dnd.tsx`                                                                  |
| Change array or children editing                          | `panel/use-dnd-items.ts` / `use-dnd-children.ts`, `utils/ast/items.ts` / `children.ts`            |
| Expose something to custom panels                         | `DndPanel` in `dnd/types.ts`, then `dnd/index.ts` and the public API snapshot                     |
| Change preview isolation or sizing                        | `components/frame/`                                                                               |
| Add UI text                                               | `components/context/messages.ts` and the Korean set                                               |

Any change to what the package exports updates
`.github/scripts/api-surface.snapshot.json` (`pnpm check-api-surface --update`).

## Known rough edges

Known places where the structure is harder to follow than it needs to be.
They're candidates for cleanup, not rules to follow.

- **`components/dnd/` is flat.** Components, state hooks, pure helpers and
  contexts sit side by side in one folder.
- **Large AST files.** `update.ts`, `value.ts` and `extract.ts` each hold more
  than one stage's worth of work.
