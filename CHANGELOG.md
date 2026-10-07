# Changelog

## 4.6.1

### Patch Changes

- 3037a70: Update the Babel packages bundled for AST editing (`@babel/parser`, `@babel/types`, `@babel/traverse`, `@babel/generator`) to Babel 8. Edits produce the same source as before. The runtime compiler, `@babel/standalone`, stays on Babel 7, so the supported Node range doesn't change.

## 4.6.0

### Minor Changes

- 6202a9a: Refuse `innerText` and plain `innerHTML` edits on a self-closing element such as `<img />`. They used to report success without changing the source, so the edit was lost without an error. `update()` and `updateAll()` now fail with the new `UpdateFailure` reason `self-closing`, and `Live.Dnd` shows the error toast or calls `onEditError`, with the new `messages.editErrors.selfClosing` text. Clearing the content of a self-closing element still succeeds, and `type: 'richtext'` still works there, since it writes `dangerouslySetInnerHTML`.

### Patch Changes

- b124cb5: Fix `autoHeight` cutting off overlays placed against the viewport, such as a bottom drawer. A `position: fixed` element's percentage `height` and its `top` or `bottom` resolve against the iframe's viewport, and the iframe's height was itself what was being measured, so a drawer with `height: 50%` stayed half of a section that never grew, and a dialog centred with `top: 50%` was cut in half. The measurement now sizes the viewport to the height the section can show, reads each fixed or absolute element's real bottom edge, and skips one moved entirely outside the viewport.
- 240d17b: Draw the element outline inside the canvas instead of on top of the whole page. The outline shows which element a panel field edits, or which one the element picker points at. It used to be portaled to `document.body` with the highest possible `z-index`, so on a phone it appeared above the panel Drawer that covers the canvas, and above any host modal. It now sits in the canvas's scroll container, under anything that covers the canvas, and it scrolls and clips with it.
- 7ec9e08: Open overlays inside the preview in `frame.mode: 'shadow'`. The `container` a preview component receives is now an overlay layer inside the shadow root that covers the preview's box, instead of an element outside the shadow root (the canvas, or `document.body` in `Live.Preview`). A modal or drawer portaled into it, such as ui-kit `Modal` or `Drawer` with `container={container}`, now opens over the preview rather than over the whole page, and gets the preview's styles. The layer lets clicks through to the preview under it, and the preview's own `fixed` and `absolute` elements are placed as before.

## 4.5.0

### Minor Changes

- bd47c70: Add `checkDocument(code, options?)` to `@jbpark/live-editor/utils`. It tells a host whether `Live.Dnd` can edit a document before saving or loading it, with the same reasons `onEditError` reports: `{ ok: true }`, or `{ ok: false, reason: 'parse-error' | 'container-not-found', ... }`.

  Deprecate the internal helpers exported from `./utils` and `./utils/ast`, such as the array-literal editing functions behind `useDndItems`, the binding resolution behind `extract`, and the document layer under `extractSections` and `replaceSections`. They keep working and leave those entries in the next major. The new Utilities page lists each one with what to use instead.

- 0705b01: Translate the editor's own text. `Live` takes a `messages` prop that replaces any of it, group by group, while every other message keeps its English default: the section toolbar, the panel, empty states, edit errors and the toast, screen-reader announcements, the error boxes of `Live.Preview` and `Live.Error`, and validation messages. A `Live` nested in another inherits its messages. `useLiveMessages()` gives a custom palette or panel the same text, `defaultMessages` is the English set, and `validateBindingValue(binding, value, { messages })` takes translated validation messages. The Items and Children editors' move and delete buttons now have accessible names. A complete Korean set is on the new Localization docs page.

### Patch Changes

- 9df5d76: `bindings` and `bindingKeys` entries typed with `BindingRegistry` or `BindingKeyMap` now accept keys of your own, such as `group`, `tab` or `description`. They arrive in `binding.meta`, as they already did at runtime and from an inline `data-binding`, but the types rejected them. One entry's type is exported as `BindingSchema`.
- ec56235: Drop the `pnpm` field from the published `engines`. It described how to develop this repository, not what installing the package needs, and made pnpm with `engine-strict` refuse to install the package on pnpm 9 or older. `engines.node` stays `>=20`, and CI now checks that the entries meant for Node load on Node 20.

## 4.4.0

### Minor Changes

- d6a0730: Bind elements by key to schemas kept outside the markup. An element with `data-binding-key="hero-title"` gets the entries under `hero-title` in `Live.Dnd`'s new `bindingKeys` prop, on an HTML element or a component alike, so per-position labels and HTML elements no longer need an inline `data-binding`. The map is plain data, so it can be loaded from JSON. Precedence is the element's own `data-binding`, then its key, then its component's `bindings` entry, each replacing the next whole. A key missing from the map, or a `data-binding-key` that isn't a plain string, gives the element no fields and a one-time console warning, as does an element with both attributes. `data-binding-key` is editor-owned, so no binding can rewrite it. Custom panels get both maps from `useDndPanel().bindingOptions` to pass to `extract()`. The AST helpers take them in one options object (`BindingOptions`): `extract(source, { bindings, bindingKeys })`, `update(..., { bindings, bindingKeys })` and `updateAll(..., { bindings, bindingKeys })`. `BindingKeyMap`, `BindingOptions`, `getKeyBindings` and `resolveBindings` are exported.
- bb3304a: Add move up and move down buttons to the selected section on the `Live.Dnd` canvas, next to duplicate and delete. They make the same move as the panel's buttons, so a section can be reordered without a drag right where it's selected, including with a custom panel that has no move controls. Move up is disabled on the first section and move down on the last. When a move takes the section to either end, focus moves to the section instead of the now-disabled button. The canvas's duplicate and delete buttons, which had no accessible name, are now labeled "Duplicate section" and "Delete section".
- daedf35: Add a binding registry: `Live.Dnd`'s new `bindings` prop maps a component's tag name, as written in the source (`ui.Button`, `Button`), to the binding entries every element of that component gets. Markup then needs only a `data-id` instead of repeating the same `data-binding` on every element, and the schema stays out of the generated code. Keys are components only: HTML elements such as `p` or `h2` are rejected by the `BindingRegistry` type and ignored at runtime with a console warning, since an entry for one would make every such element editable. An element's own `data-binding` still takes precedence, whole, and `data-binding={[]}` opts one element out. The registry applies to the built-in panel, `useDndPanel()`, `Live.Dnd.Field`, and elements inside `items` and `children` values. The AST helpers take it as an option: `extract(source, { bindings })`, `update(..., property, { bindings })` and `updateAll(code, entries, { bindings })`. The `BindingRegistry` type is exported from the package root and `@jbpark/live-editor/utils/ast`, along with `BindingComponentName`, `getRegistryBindings`, `isComponentTagName` and `readNodeBindings`.
- ca62d75: Show which element each panel field edits. When a section has more than one editable element, the built-in panel heads each element's fields with its tag name and text (for example `ui.Typography.Title` and "Fast setup"), so fields that share a label, as the binding registry and keys make common, can be told apart; a section with one editable element looks as before. Each group is also a labeled `role="group"`. Hovering over or focusing a field outlines its element on the canvas, nested Items and Children fields included. For custom panels, each `PanelBinding` carries `element: { tagName, text }`, and `useDndInspector()` has `highlight(id)` to draw the same outline.

### Patch Changes

- 4523f05: Fix iframe previews that couldn't scroll when the host page sets `body { overflow: hidden }`. With `syncStyle`, an iframe preview copies the host's stylesheets, so an app shell's rule that keeps its own page from scrolling also stopped a fixed-height preview (`autoHeight` off, as in `Live.Preview`) from scrolling its content. The iframe's `<body>` now gets an inline `overflow-y: auto` when the frame isn't sized to its content, which wins over any copied rule. Frames with `autoHeight`, like `Live.Dnd`'s canvas sections, are unchanged.
- c5590c8: Fix iframe sections losing the scripts from `frame.scripts` after the canvas sections are reordered. Moving an iframe in the DOM reloads it with a fresh document, but the frame skipped every script it had already loaded once, so the moved section's new document never got them. A Tailwind browser build loaded this way left the moved section unstyled. The frame now loads its scripts again whenever it gets a new document.

## 4.3.1

### Patch Changes

- e6181c4: Fix iframe previews staying on the light theme when the host page is in dark mode. With `syncStyle`, an iframe preview copied the host's stylesheets but not the class or attribute the theme is switched with on the host's `<html>` (`.dark`, `data-theme="dark"`), so dark-mode selectors never matched inside the iframe, while the same code in `shadow` mode followed the host. `syncStyle` now also mirrors the host `<html>`'s classes and `data-*` attributes onto the iframe's `<html>` and keeps them in sync, so a theme switch reaches the preview as it happens. Classes the preview set on its own root are kept, and other attributes (`style`, `lang`, `dir`) are left alone.

## 4.3.0

### Minor Changes

- 2e60038: Pick an element in the canvas preview to edit its fields.

  - A crosshair button at the bottom-left of the canvas turns on an element picker. The element under the pointer is outlined, and a click selects its section and brings its fields into view in the built-in panel, including fields nested in an Items or Children editor. Escape cancels, and sections can't be dragged while the picker is on.
  - `onNodePick` on `Live.Dnd` reports each pick as `{ id, sectionId }`, where `id` is the element's `data-id`, the key its fields carry in `useDndPanel().bindings`.
  - `useDndInspector()` returns `active`, `activate`, `deactivate`, `toggle` and `picked`, for a custom layout or panel. The `DndInspector` and `DndNodePick` types are exported.
  - It works in every frame mode: iframe, shadow root, or rendered in place.

- 60532b8: Collapse items and reorder them by dragging in the Items editor.

  - Each item in the built-in Items editor can collapse to its header, and "Collapse all" / "Expand all" sits above the list.
  - Items reorder by dragging their handle. A mouse drag starts after a few pixels, a touch drag after a long press, and the keyboard picks an item up with Space or Enter. The drop commits through `actions.move`, the same edit the up/down buttons make. The up/down buttons and bulk actions are unchanged.
  - `useDndItems()` returns `expansion` (`expandedIds`, `isExpanded`, `toggle`, `setExpanded`) for custom panels. It's keyed by item `id`, so an item stays collapsed when it moves or a sibling changes, and every item, including one added later, starts expanded.

### Patch Changes

- 8be933b: `Live.Error.Boundary` no longer renders its fallback one more time when `resetKeys` change after an error. The error used to be cleared after that render had already committed, so the fallback rendered again with the new props, and any of its effects keyed on them ran again, on every recovery. Nothing on screen changed. The error is now cleared in the render that sees the new keys, and a throw with the new keys is still caught.
- e1bc134: Fix an iframe preview collapsing to a pixel when `syncStyle` is switched on after the frame has mounted and the host page sets `html { height: 100% !important }`. Each frame keeps a style that fixes its `<html>` to the reference height `vh` units resolve against, and the host's synced styles have to stay in front of it. A first sync that ran after that style existed appended the host's copies behind it instead. The host rule then won on order, `vh` resolved against the frame's own height, and the auto-height loop shrank the frame to 1px (measured with a `50vh` section in Chromium). Synced styles now always go in front of the frame's own style, however late the first sync runs.
- 596735a: `setEditableValue` now changes only the leaf at `path` and leaves the rest of the value as written. It used to re-serialize the whole value as JSON, so editing one field of an `items` array turned every JSX value in it into plain text, dropped functions such as `onClick`, and lost comments and formatting. A string keeps the quotes it was written with, and a JSX leaf stays JSX when the edited text still is. A path it can't point at with certainty, such as one an object spread could override, returns the value unchanged.
- d3c06ea: Fill a section's empty `data-id`s the same way in the panel and the canvas preview. The panel used to fill them with random ids, new each time the section's code changed, while the preview rendered them empty. Now both derive them from the section's id in document order (`<section id>-1`, `-2`, ...), skipping ids the section already uses. So an element in the preview carries the `data-id` its fields have in `useDndPanel().bindings`. As before, the ids reach the source only with the first edit to the section.

## 4.2.0

### Minor Changes

- 9838e72: Rename the two structural editing hooks to match the rest of the `useDnd*` family: `useItemsEditor` is now `useDndItems` and `useChildrenEditor` is now `useDndChildren`. Their types follow the same rule: `ItemsEditor*` is now `DndItems*` (for example `ItemsEditorItem` → `DndItemsItem`), and `ChildrenEditor*` is now `DndChildren*`. The old names are still exported from `@jbpark/live-editor/dnd`, and the three item types from the package root, as deprecated aliases of the new ones, so existing code keeps compiling and behaves the same. They will be removed in the next major.
- 2f56573: Let `Live.Dnd` work with a document built around any container id, and say so when the container is missing. A document's sections are the `<section>` elements inside the element with `id="app-container"`. That id was fixed, and a document without it (including an empty string) had no sections: everything added from the palette was silently dropped.

  - `Live.Dnd` takes a `containerId` prop, which defaults to `app-container`.
  - When the document has no element with that id, `Live.Dnd` reports it once through `onEditError`, or a toast by default. The error is a new `DndEditError` shape: `{ type: 'parse', target: 'document', reason: 'container-not-found', containerId }`. The empty canvas names the missing id too.
  - New `createDocument({ containerId? })` in `@jbpark/live-editor/utils` returns an empty document `Live.Dnd` can add sections to. Start a controlled `Live.Dnd` from it rather than from `''`.
  - `extractSections`, `replaceSections`, `generateSection` and `generateSections` in `@jbpark/live-editor/utils` take an optional `{ containerId }` as a last argument. So do `parseDocument`, `replaceDocumentSections`, `generateSectionPreview(s)`, `fillSectionIds` and `createSectionPreviewCache().compute` in `@jbpark/live-editor/utils/ast`.
  - New `inspectDocument(code, options?)` in `@jbpark/live-editor/utils/ast` works like `parseDocument` but says why a source isn't a usable document: `'parse-error'` or `'container-not-found'`.
  - New exported types: `DocumentOptions`, from both entries; `DocumentInspection` and `DocumentProblem`, from `utils/ast`.

  Existing documents that use `app-container` behave as before. The Drag & Drop guide has a new "Document structure" section, and its examples start from `createDocument()`.

- 3ed041f: Export `getFieldKind` and `isStructuralFieldKind` from `@jbpark/live-editor/dnd`, along with their `FieldKind` and `FieldKindBinding` types. `getFieldKind(binding)` returns which built-in control `Live.Dnd.Field` renders for a binding (`'items'`, `'children'`, `'richtext'`, `'select'`, `'number'`, `'text'`, and so on). `Field` now picks its control with this same function, so a custom panel can ask the library instead of copying its checks. `isStructuralFieldKind(kind)` is `true` for `'items'` and `'children'`, the two kinds whose value holds further data-bound elements. A headless panel can use it to send those bindings to `useDndItems`/`useDndChildren` at every depth. `Field`'s behavior is unchanged.
- 258f5b0: Export `resolvePanelBindings` and `withPanelCommit` from `@jbpark/live-editor/dnd`, along with their `PanelBindingSource` and `PanelBindingData` types. They are the two steps behind `useDndPanel().bindings`: the first reads a `DataAttrNode`'s `data-id` and `data-binding` into bindings (or returns `null` when the element isn't editable), and the second attaches `onChange`, committing through `onNodeChange`. A custom panel can now build `PanelBinding`s for elements the panel doesn't hand over itself, such as the fields inside each child from `useDndChildren`, and render them with `Live.Dnd.Field` instead of reading the AST by hand.
- 804f9b7: Move between canvas sections from the keyboard, delete the focused one, and keep the selection in view. On a focused canvas section, Arrow Up and Arrow Down go to the previous or next section and select it, and Home and End go to the first or last. Delete or Backspace deletes the section through `onBeforeDelete`, then moves focus to the section that took its place, or the previous one, so focus isn't dropped on the page. These keys only count on the section itself, not inside its content, and not while a section is picked up. The selected section also scrolls into view whenever it ends up out of sight, including after the panel's move buttons.
- a997ae6: Make the `Live.Dnd` palette and canvas usable from the keyboard, and let the host confirm a delete. Palette cards and canvas sections could be reached with Tab and announced themselves as buttons, but did nothing on Enter, and sections couldn't be moved without a pointer.

  - Enter on a canvas section selects it, like a click. Enter on a palette card adds it, like a double-click.
  - Space picks a section or card up, the arrow keys move it, Space or Enter drops it, and Escape cancels. This is dnd-kit's keyboard sensor, with Enter kept for selecting. Screen readers hear the section's name and position rather than its generated id.
  - Palette cards show a focus ring for keyboard focus. They had `outline-none` and no replacement.
  - New `onBeforeDelete` prop: `(section) => boolean | Promise<boolean>`. It runs before a section is deleted from the canvas, the panel, or a custom panel's `onDelete`, and `false` keeps the section. A promise is waited for, and the delete then applies to the document as it is at that point. A throw or rejection keeps the section.

- 2247ec3: Commit several panel edits as one change. `useDndPanel()` returns `onNodesChange`, which takes an array of the same `{ id, label, property, value }` edits `onNodeChange` takes. They apply in array order, all or none: if any edit is refused nothing is committed, and `onEditError` (or the toast) reports the first one that failed. On success `Live.Dnd`'s `onChange` is called once. Before, a control that writes more than one binding had to call `onChange` on each, which reached the host as separate changes and left the earlier ones applied when a later one failed.

  - New `updateAll(code, entries)` in `@jbpark/live-editor/utils/ast` does the same on a source string. It returns `{ success: true, code }`, or `{ success: false, code, failure, index }` with the source untouched. New types: `UpdateEntry` and `UpdateAllResult` there, and `PanelNodesChange` from the dnd entry and the package root.
  - `bulkUpdate` is deprecated and will be removed in the next major. It applies the entries that succeed even when another fails, so it can't back a single commit. Its behavior is unchanged.
  - `onNodeChange` behaves as before. It now runs through the same path as a batch of one.

- 9d82d41: Name sections without a `data-name` in English by default, and let the host choose the name. A `<section>` with no `data-name` used to be named with a fixed Korean label (`1번째 컴포넌트`, ...), whatever the consumer's locale. It's now `Section 1`, `Section 2`, and so on, on the canvas, in the panel, and in `extractSections()`. Pass `sectionNameFallback` to `Live.Dnd` to name them yourself: it gets the section's 0-based position. `extractSections()` from `@jbpark/live-editor/utils` and `getSections()` from `@jbpark/live-editor/utils/ast` take the same option as an optional second argument, and the `SectionOptions` type is exported from both entries. Sections that have a `data-name` are unaffected.
- 77a0d27: Keep the `Live.Dnd` canvas and panel populated while the document doesn't parse. A source with a syntax error, which is what the code editor holds for most of a keystroke, used to empty the canvas and the panel until it parsed again. They now show the last version that parsed, with a notice on the canvas and in the panel, and stay read-only until the source parses again.

  - An edit tried while the document doesn't parse is refused and reported through `onEditError`, or a toast by default. The error has a new `DndEditError` shape: `{ type: 'parse', target: 'document', reason: 'parse-error', error }`. Such edits used to call `onChange` with the source unchanged, and say nothing.
  - `useDndPanel()` returns `readOnly`, which is `true` in that state.
  - `useDndLayout()` returns `documentError`: `'parse-error'`, `'container-not-found'` or `null`.
  - A document that has never parsed shows "The document has a syntax error" on the canvas instead of "No sections available".

- 69fd2b1: Switch an optional attribute off and on from the panel. Committing `undefined` through a binding's `onChange`, `onNodeChange`, `onNodesChange` or `update()` now removes the attribute, and committing a value for an attribute the element doesn't carry adds it. Before, `undefined` was written as the text `"undefined"` (`title="undefined"`, `size="undefined"`, or "undefined" in an element's text), and a binding for a missing attribute failed with `attribute-not-found`, so an optional prop couldn't be toggled at all.

  - An empty string still writes `prop=""` on an attribute that's there, and leaves a missing one missing.
  - `undefined` empties `innerText` and `innerHTML`. Removing `children` as a whole is refused with `unsupported-syntax`.
  - A `required` binding can't be removed. `update()` refuses it with a new `'required-property'` failure, which the panel reports through `onEditError`.
  - `PanelBinding.present` is `false` while a bound attribute is missing. A missing attribute's field is no longer read-only (`canEditValue`), since a value adds it.
  - A new attribute goes after the element's last one, on its own line when the tag puts one attribute per line.

  A binding whose `property` has a typo used to be reported as `attribute-not-found`. Now it adds an attribute with that name.

### Patch Changes

- 725b8b5: Lay out the preview iframe as a block. It used the browser default, inline, so each frame sat on a text baseline and left a gap of about 4px below it. In `Live.Dnd`, where every canvas section has its own auto-height frame, those gaps added up to height no content accounted for, which could put a scrollbar on the canvas. A `style.display` passed through `frame` still takes precedence.
- b911ecf: The built-in panel's validation error no longer shifts the fields below it. The error paragraph had no bottom margin of its own, so in a page without a CSS reset it picked up the browser's default `1em` (12px), pushing every field below down by 8px when the error appeared and moving them back when it cleared. It now sets `margin-bottom: 0`, so the gap to the next field stays at the panel's own 4px. Pages that already run Tailwind's preflight or another reset look the same as before.
- 01e2e00: Fix a full-height section overflowing the `Live.Dnd` canvas when the layout around it has vertical margins, or when the canvas itself has vertical padding. The reference height that `vh` units resolve against in each section frame took the canvas height and subtracted the border and padding of the wrappers between the canvas and the frame. It didn't subtract their margins, or the canvas's own padding. A `100vh` section was therefore taller than the space it had, by that amount, and the canvas scrolled. Both are subtracted now. The built-in layout has neither, so it renders the same as before.
- 1d34220: Fix `useDndItems` dropping an edit when two edits to the same array happen in the same tick. Every edit computed the next array from the one the last render passed in, so a second `add()`, a second item property edit, or any structural action right after another one overwrote the first. Each edit now builds on the one before it. That includes the item ids and the selection, so two `add()` calls in a row give two new items, each with its own id. An item edited after a same-tick move is still the item that was edited, not whatever took its old position. Editing an item removed earlier in the same tick does nothing. Once the next render arrives, the value it passes in is the source of truth again, so an edit the host didn't accept isn't carried forward.
- 341cd84: Fix `Live.Dnd` dropping an edit when two commits happen in the same tick. Every commit used to start from the document of the last render, so a second commit made before the host handed the new value back wrote the first one's change back out. That covered two `PanelBinding.onChange` calls in a row, two `onNodeChange` calls, or a binding edit next to a section move, add, copy or delete. Each commit now builds on the one before it. Once the next render arrives, the `value` it hands in is the source of truth again, so a commit the host didn't accept isn't carried forward.
- 73cb3a9: Fix preview scripts from `frame.scripts` occasionally not loading, with no error. Each script is cached as a blob URL, and the cache revoked a URL as soon as it evicted it. A frame waiting on several scripts, or several frames loading at once, could push more distinct scripts through the cache than it holds. The first URLs were then revoked before the frame injected them, and those `<script>` elements silently failed. A frame now holds its scripts' URLs until it has injected them. An evicted URL that is still held is revoked when the frame is done with it.
- 14963e1: Let a `<section>` carry its own `data-binding`. The panel used to drop the section's root element from its fields, so a binding written on the section itself (for a background, padding or spacing) was silently ignored. It now shows up like any other element's, ahead of the elements inside the section. Sections without a `data-binding`, which includes every default palette section, behave as before.

  The editor's own attributes, `data-id`, `data-name` and `data-binding`, can't be the target of a binding. A field on one of them is read-only (`canEditValue: false`), and `update()` refuses it with a new `'reserved-property'` failure, which the panel reports through `onEditError`.

## 4.1.1

### Patch Changes

- e30c148: Stop loading Babel where it isn't needed. `Live.Editor`, `Live.Error` and the `Live` provider no longer bundle `@babel/standalone` or Babel's AST packages, and `Live.Preview` no longer bundles the AST packages, which only the drag-and-drop editor and `./utils/ast` use. Measured in a minified consumer build: a provider plus `Live.Editor` drops from 1,151 KB to 190 KB gzipped, and a provider plus `Live.Preview` from 1,354 KB to 1,074 KB. The full editor and `./utils/ast` are unchanged, and so is every export of `./utils`.
- 560109f: Passing `modules` inline (`modules={{ Chart }}`) no longer re-renders and recompiles every canvas section on each edit. A fresh `modules` object with the same entries is now treated as unchanged by `Live.Dnd` and `Live.Preview`; replacing, adding, or removing a module still recompiles. At 90 sections this took an edit from 90 Babel runs to one.

## 4.1.0

### Minor Changes

- abe85ff: Update `@jbpark/ui-kit` to 10. live-editor's own API is unchanged, but the
  `ui-kit` module that previewed code imports (`import * as ui from 'ui-kit'`)
  is now ui-kit 10, so a stored document can need updating if it relies on what
  10.0 changed:

  - `Button` (and `Container`, `Layout.Content`) no longer take `asChild`. Pass
    the element as `render={<a href="…" />}` and keep the content as children;
    for `Button`, add `nativeButton={false}` when that element is not a button.
  - `Drawer` no longer takes `draggable`, and bottom drawers can no longer be
    dragged to dismiss.
  - `Checkbox`, `Switch`, `Radio`, `Select`, `Slider`, `Progress`, `Collapse`
    and the dialogs are rebuilt on Base UI. Their documented props are kept, but
    their DOM is different: a `Checkbox` or `Switch` is no longer a native
    control, so read `aria-checked` / `aria-disabled` rather than the `checked` /
    `disabled` DOM properties.

  The built-in panel follows the same change: its selection checkboxes report
  `aria-disabled` instead of a native `disabled` property.

### Patch Changes

- abe85ff: Load the Tailwind compiler only when `dynamicTailwind` is on. It and its theme
  used to be part of every consumer's initial bundle, about 300 kB before
  compression, whether or not a preview ever compiled a class. It is now fetched
  the first time a preview with `dynamicTailwind` renders, and never otherwise.
- 18ab6cc: Stop re-rendering every canvas section on every edit. `Live.Dnd` without a
  `modules` prop created a new empty object each render, and a `frame` written
  inline (`frame={{ mode: 'iframe' }}`) was a new object each render too; either
  one defeated the per-section memo, so each edit re-rendered and re-looked-up
  the compiled module of every section. Past the compilation cache's 50 entries
  that became a Babel recompile of most sections per edit.

  `modules` now defaults to one shared object, in `Live.Preview` as well, and a
  section compares `frame` by value. Measured from committing a panel edit to
  the canvas showing it, in Chromium with an inline `frame`:

  | Sections | Before   | After  |
  | -------- | -------- | ------ |
  | 9        | 78 ms    | 54 ms  |
  | 45       | 177 ms   | 79 ms  |
  | 90       | 1,379 ms | 127 ms |

## 4.0.1

### Patch Changes

- d09183c: Make `Live.Editor` keep to the documented code-ownership contract.

  - Without `value`, the editor dropped every edit: it kept no state of its own,
    so typing never showed up or reached the preview. It now holds a draft that
    shows each keystroke at once, pushes it to `Live`'s shared code after
    `debounce`, and follows changes other surfaces make to that code, so a
    `Live.Dnd` without `value` beside it stays in step. Without `defaultValue`,
    it starts from the shared code instead of always from the built-in template.
  - A push still waiting for `debounce` used to be dropped when the editor
    unmounted, leaving `Live.Preview` on older code than the host had. It now
    runs at once on unmount, and when focus leaves the editor, so clicking into
    another surface right after typing works on the typed code.

  The rules are documented under "Who owns the code" in Editor Mode. Requires
  `@jbpark/use-hooks` 4.1.0.

- fc50f8d: Give the Items and Children editors one selection rule, shared through a
  single hook.

  - Fix Items keeping a stale selection when its value changed from outside
    (undo, another field, an external `value`): the same positions then named
    different items, so a following bulk delete, move or duplicate acted on items
    the user never selected. It is now cleared, as Children already did.
  - Children now keeps the selection where Items did: a moved block stays
    selected at its new positions, so it can be moved again without reselecting,
    and duplicating or adding leaves the selection as it was. It used to clear
    after every edit.

  `useItemsEditor` and `useChildrenEditor` keep their return shapes. The full
  rule is documented under "Selection after an edit".

## 4.0.0

### Major Changes

- 8d6c841: Draw the line between what the library owns and what a panel owns: the
  library describes a value's data kind (`type`) and its constraints
  (`min`/`max`/`pattern`/`required`); choosing and drawing a control is the
  consumer's. `widget` is passed through untouched and the built-in panel no
  longer reads it.

  **Breaking**

  - The built-in `icon-picker` and `asset-picker` controls are removed, along
    with the `ICON_MAP`/`ICON_OPTIONS` exports. A binding declaring either
    widget now gets the built-in default control for its `type`. Render your
    own control in a custom panel by switching on `binding.widget.type`.
  - `icon-picker`/`asset-picker` are no longer `BindingType` values. An
    authored `type: 'icon-picker'` is treated like any unrecognized type: the
    field is kept, untyped. Author `type: 'string', widget: 'icon-picker'`
    instead.
  - A render-map leaf's `PanelBinding.property` is now the object key when the
    leaf declares no `property`. It used to be the leaf's `type` name, or
    `undefined` when that type was unrecognized.

  **Render-map leaves are full fields**

  A nested `render` leaf now accepts every field a top-level binding does —
  `label`, `widget`, `options`, `min`, `max`, `pattern`, `required`, and
  consumer-defined keys under `meta` — and they reach the panel. Nested item
  fields are validated the same way flat fields are; a leaf's `required` or
  `min` used to be silently dropped. The leaf path now goes through the same
  field conversion as every other panel path, and the items editor's
  `meta.valueType` is merged into the leaf's own `meta` instead of replacing it.

  **More forgiving parsing**

  A malformed `min`, `max`, `pattern` or `required` now degrades just that
  field, as `type`, `widget` and `options` already did, instead of dropping the
  whole binding.

- 5441b17: Make `@jbpark/live-editor/utils`, `/provider` and `/error` importable outside a
  bundler. `./utils` imported `@jbpark/ui-kit` at module scope to build
  `baseModules`, and evaluating the UI kit reaches its stylesheet imports, so
  importing any of these entries in Node (SSR, build scripts, tests) threw
  `Unknown file extension ".css"`.

  **Breaking:** `baseModules` moved from `@jbpark/live-editor/utils` to
  `@jbpark/live-editor/preview`, next to the preview that uses it. Update the
  import if you read it directly:

  ```ts
  import { baseModules } from '@jbpark/live-editor/preview';
  ```

  Compiled samples resolve `'ui-kit'` and `'ui-kit/utils'` exactly as before.

### Minor Changes

- a0887d5: Add two `Live.Dnd` props for customizing the built-in panel without replacing
  it.

  - `renderField(props, builtin)` is called before the built-in control for
    every field: top-level bindings, keys inside an `object` value, array item
    properties, and `Live.Dnd.Field` in a custom panel. Return a node to replace
    the control, `null` to render nothing, or `undefined` to keep `builtin`.
    Switch on `binding.widget?.type`, `binding.type` or anything else on the
    binding.
  - `onEditError(error)` receives every edit the editor could not apply — a
    rejected field update, a section or `items` value that fails to parse, or
    a refused array edit — instead of the built-in toast. The payload carries
    the toast's `title` and `description`, plus `failure.reason` for updates.

  Both are exported as types: `DndRenderField` and `DndEditError`.

- 4b0c59a: Let consumers replace the error box shown for a canvas section that fails.

  - `renderSectionFallback({ section, reason, message })` renders in place of a
    section that failed to compile (`'compile'`), threw while rendering
    (`'runtime'`), or was skipped (`'forced'`). Return `undefined` to keep the
    built-in error box. A fallback that throws reverts to the built-in one for
    that section only.
  - `shouldForceSectionFallback(section)` runs before a section is compiled.
    Returning `true` skips compiling it, so none of its top-level code runs, and
    renders the fallback with reason `'forced'`.

  Neither changes rendering, memoization or error isolation when omitted. Both
  types are exported: `DndRenderSectionFallback` and `DndSectionFallbackArgs`.
  `Live.Error.Boundary`'s `fallback` also receives a `reset` function as its
  second argument.

- ef8fc04: Let a binding's `widget` carry that control's own configuration instead of
  only naming it:

  ```js
  {
    label: 'Content Spacing', property: 'size', type: 'number',
    min: 0, max: 40,
    widget: { type: 'slider', step: 4, unit: 'px' },
  }
  ```

  `step`/`unit` are typed fields on `widget`, and any further control-specific
  keys pass through as before, so a custom panel reads them without narrowing
  `unknown`. `min`/`max`/`pattern`/`required` stay on the item: they are value
  constraints `validateBindingValue` enforces with or without a widget, so
  moving them would make a range unexpressible for a plain number input and
  give a slider a second, conflictable copy of its bounds.

  Not a breaking change. The bare-string form (`widget: 'slider'`) still parses,
  normalized to `{ type: 'slider' }`, so consumers only ever switch on
  `widget.type`.

  Also fixes a latent parse defect on the same field: a malformed `widget` used
  to fail the item schema and drop the entire binding, so the field vanished
  from the panel with no error. It now degrades to widget-less and keeps the
  field, matching how an unrecognized `type` behaves.

### Patch Changes

- d6aa94f: Stop `autoHeight` from dropping elements that are still animating. A
  `position: fixed`/`absolute` element part-way through a fade-in sits at
  computed `opacity: 0`, which the measurement walk read as permanently hidden
  and left out of the height — a section whose only content was such an element
  kept the browser's default 150px iframe height, and one with flow content was
  clipped to it. An element at `opacity: 0` with a running or paused keyframe
  animation is now measured, while a closed overlay and a finished fade-out
  holding `opacity: 0` through `animation-fill-mode: forwards` stay excluded.

  The height is also re-measured when an animation settles, which no observer
  used to notice: a finishing animation is neither a DOM mutation nor a resize,
  so a height read mid-fade stayed on the iframe until something unrelated
  happened to the DOM. CSS animations are picked up through bubbling
  `animationend`/`animationcancel`, and script-driven ones (`element.animate()`)
  through their `finished` promise, since the Web Animations API dispatches no
  DOM event.

- a30b708: Stop `autoHeight` measurement from cancelling the preview's own CSS
  transitions. The measurement pass applied `transition: none !important` to
  every element, which does not pause a transition for the duration of the read
  — it cancels it, and lifting the override afterwards does not resume it. Since
  a DOM mutation is both what schedules a measurement and what typically starts
  a transition (a class toggle opening an overlay), a fading overlay snapped
  straight to its end state.

  The override is now applied only on a pass that actually moves the probe
  height, which is the only thing the measurement itself changes. A pass that
  leaves the probe height alone changes nothing about the document, so there is
  nothing to freeze.

  Two consequences of transitions being allowed to run: the height is
  re-measured on `transitionend`/`transitioncancel`, which no observer used to
  notice, and an element at `opacity: 0` with a running transition now counts as
  in flight for the height estimate, the same as one with a running keyframe
  animation.

- 130e682: Make the default palette exercise every binding option the library supports.
  Hero's background style is now an `object` binding with a typed `color` key,
  its button gains a `jsx` icon field, and its variant options include the
  `solid` value the button actually uses. Stats exposes its marquee speed (with
  the bare-string `widget` form) and a `boolean` pause-on-hover toggle. A new
  Roadmap section shows an `array` binding whose render-map leaves use labels,
  options, constraints, widgets, an `object` leaf with its own render map, and
  consumer metadata, alongside top-level `date` and `url` fields.

  Also fix nested keys of an object value in the built-in panel being headed by
  the raw key instead of the render-map leaf's `label`.

- aa786ee: Release every editor-owned cache when the last provider unmounts, not just
  the compilation cache. Parsed documents, extracted bindings and the blob URLs
  generated for external scripts previously outlived an editing session, freed
  only when their LRU happened to evict them — so opening and closing an editor
  repeatedly in one tab accumulated source-derived data, and blob URLs stayed
  un-revoked.

  `clearEditorCaches()` is the one place that knows the full set, so a cache
  added to the compile or AST pipeline no longer has to be remembered at the
  provider too. `clearScriptCache()` is exported alongside it for the script
  cache on its own.

  Cleanup is now reference counted through `registerEditorSession()`. Clearing
  on any single unmount reached into providers that were still mounted, which
  was survivable when a wasted compile was the only cost but is not once
  revoking blob URLs is part of it.

- e2d4f3f: Fix two defects in the preview compile/script pipeline, and translate its two
  remaining Korean error messages to English.

  - `compile()`'s `require` shim tested a module's truthiness instead of its
    presence, so a module whose value is legitimately `0`, `''`, `false`, or
    `null` was reported as missing — even though the compilation cache already
    supports and compares primitive modules by value.
  - `getCachedScriptBlob()` dropped its in-flight entry only on success, so one
    failed fetch left a rejected promise in the map that every later caller
    adopted: that script stayed unloadable for the rest of the session even
    after the network recovered. `preloadScripts()` also no longer raises an
    unhandled rejection when a preload fails.

- 68745a7: Resolve a data-bound element into panel bindings through one shared conversion. The built-in panel, a custom panel's `useDndPanel()` bindings and the nested editors inside an `items` value previously repeated the same `DataAttrNode` -> `PanelBinding` mapping, so a binding field could reach one surface and silently miss the others. All three now read the same conversion, which keeps `widget`, `render`, constraints and consumer-defined `meta` consistent across them. No public API change.
- a2039a6: Expose value and array-structure editability to custom panels, disable lossy
  built-in controls before mutation, preserve unsupported expressions, and
  document the supported editable syntax.

## 3.2.1

### Patch Changes

- 3938ee8: Preserve focus and selection in nested JSX fallback editors when array items move.
- 67ecbbc: Document a fix that shipped in 3.2.0 without a changelog entry: panel fields now skip no-op commits.

  `Field` compared a pending edit against two different canonical values depending on the control — raw source text for some, the parsed structured value for others — so an edit that changed nothing still committed and rewrote the document. The guard now picks the comparison shape from the emitted value and is shared across the text, select, date, asset, color, and editor controls.

  The code change was released in 3.2.0 (027a092, PR #361, fixing #319) but carried no changeset, so the 3.2.0 notes omit it. This entry exists to close that gap; no further behavior change is included here.

## 3.2.0

### Minor Changes

- 7f9cc15: Preserve item identity across moves, deletes, and duplicates in the Items panel, ensuring stable React keys and consistent UI behavior.

### Patch Changes

- a5898fa: Keep Babel traverse implementation details out of generated declarations so strict TypeScript consumers can import the AST utilities without invalid Babel type references.
- fd8d341: Make the empty-array state in the Items panel explain itself instead of showing a permanently disabled Add button. An array binding is editable only while it holds at least one item — the panel copies an existing item and never guesses the shape of a new one — so an array authored as `[]` now renders that contract as a notice pointing at the code editor. This is the same invariant `removeArrayItems` already maintained by refusing any edit that would empty an array, now stated in one place and applied consistently to both the object and primitive branches. A parse failure is reported separately from an empty list rather than both collapsing to `Items (0)`.

  Key panel field lists by property and label together instead of by label alone. A label is free text from the authored `data-binding` and carries no uniqueness guarantee, so two bindings sharing one (for example `Color` on both `color` and `backgroundColor`) collided as React keys, producing a duplicate-key warning and letting a field's local control state carry across to the wrong binding. The commit path has addressed bindings by property since 58e2171; the keys in `FieldGroup`, `Node` and the nested item groups now agree with it.

- 5cc1c76: Preserve explicitly empty code across Editor, Dnd, and Preview instead of replacing it with a default template or shared context value.
- 4e4cb5d: Preserve untouched array item subtrees during panel edits so nested controls retain focus and interaction state.
- 6275c0b: Reconcile host stylesheets and style tags in iframe and Shadow DOM previews so additions, updates, removals, and duplicate styles stay synchronized.

## 3.1.0

### Minor Changes

- c34be3a: Preserve JSX source during Children reorder, remove, duplicate, and add operations. Keep intervening expressions, text, and comments intact; give copies fresh IDs and refuse unsupported or stale edits without changing source.

  Expose useChildrenEditor for custom panels and reconcile selection after accepted edits to prevent later bulk actions from targeting the wrong child. Keep safe legacy JSON children updates supported.

### Patch Changes

- aae6612: Invalidate compiled results when injected module values or references change, so separate previews using the same source with different module implementations do not reuse each other's output. Equivalent module maps still reuse cached results regardless of key insertion order, and all module variants share the existing 50-entry LRU limit.

  Module objects and functions are compared by reference rather than serialized. To change an implementation in React, pass a new module object and a new modules map. In-place mutation of a module's properties is not automatically detected; direct compile callers can clear the compilation cache before recompiling.

- 7b9a162: Fix a panel edit reverting a newer change made to another section.

  While a section was selected, any change to the rest of the document that left the selected section's own source untouched was silently rolled back by the next edit committed from the panel. Editing a sibling section, moving or deleting one, undoing, or swapping the `onChange` prop all produced this: the panel's commit rebuilt the document from the snapshot it had been holding since the selection was made, so the newer text was overwritten with the old.

  The cause was one `useMemo` doing two jobs. `bindings` was keyed on the parsed fields alone, and those are derived from the selected section's source — so an edit elsewhere left the key identical, the memo was reused, and every `onChange` it held stayed bound to the previous document.

  Parsing and callback binding are now separate: the parse is still memoized per section source, while the callbacks are rebound each render, the same split `useItemsEditor` already uses. Every commit therefore reads the current document.

  `PanelBinding` is unchanged in shape, and this applies to the built-in panel, a wrapped `Live.Dnd.Panel`, and custom markup over `useDndPanel()` alike. The array `useDndPanel().bindings` returns is no longer referentially stable across renders — it never usefully was, since the surrounding context value and `panel` object were already rebuilt every render. A custom panel that puts `bindings` in a `useMemo`/`useEffect` dependency array will now see it change each render; depend on the values read from it instead.

- a6f123d: Preserve original array positions and source during Items edits, including sparse slots, comments, formatting and untouched JSX. Move, remove and copy dense array elements through source spans; reject unsupported sparse/spread structural changes without committing or clearing selection.

  Preserve serialized arrays through extraction and JSX write-back, retain nested expressions in copies, and reconcile bulk-move selection for mixed arrays.

## 3.0.2

### Patch Changes

- 582cf70: Consume `@jbpark/ui-kit`'s `CodeEditor` instead of a local CodeMirror surface

  The CodeMirror wiring (editor component, JS/TS + line-wrap extensions, the
  Cmd+S save transaction and the unified diff view) now comes from
  `@jbpark/ui-kit/CodeEditor` (#309, follow-up to ui-kit's #346). live-editor
  keeps its own glue — the debounced preview sync, error context, and the
  `raw`/`fragment`/`prettierOptions` prettier shaping — so the editor's public
  props and behaviour are unchanged.

  - `editor/core` is now a thin adapter that maps live-editor's vocabulary onto
    `CodeEditor` (`onError` → `onFormatError`, `raw` skips the injected
    formatter).
  - `diff-modal` uses `CodeEditor`'s `diff` prop rather than wiring
    `unifiedMergeView` by hand.
  - Bumps `@jbpark/ui-kit` to `^9.0.0`.

## 3.0.1

### Patch Changes

- 6d35c47: Fix array edits corrupting the document when the binding declares no `type`.

  Adding, removing or reordering an item in the panel's array editors rewrote `items={[...]}` into a quoted string attribute — `items="[{\n  key: '1', label: <p data-id=\"a\">…"` — leaving the section unparseable, so the panel emptied and the preview stopped updating. Both shipped sections hit this: `FAQ` and `Stats` declare `{ label: 'FAQ Items', property: 'items' }` with no `type`, and the serializer only recognized an array when `type: 'array'` was spelled out.

  `update()` now also reads what the attribute already holds, the same evidence `getStructuredValue()` uses on the way out. An attribute authored as an array or object literal keeps its expression form when the committed value is itself an array or object literal. Anything else is unchanged: `className={cn(...)}` and `items={rows}` are left alone, and a plain string committed against a text attribute is still written as a string literal.

  This affects every panel mode equally — the built-in `Items` control, a wrapped `Live.Dnd.Panel`, and custom markup over `useItemsEditor` all commit the array as source text through the same path.

## 3.0.0

### Major Changes

- 93a410e: Redesign `Live.Dnd`'s customization surface around components and hooks instead of render props. Not customizing behaves exactly as before; customizing now reaches the layout, the palette and the panel through the same mechanism.

  `renderPalette` and `renderPanel` are **removed**. What they handed over is now published as data through three hooks, and a replacement is an ordinary component rendered inside `Live.Dnd`:

  ```tsx
  import { useDndPanel } from '@jbpark/live-editor/dnd';
  
  const MyPanel = () => {
    const { item, bindings, onNodeChange } = useDndPanel();
    // ...
  };
  
  <Live.Dnd value={value} onChange={setValue}>
    <Live.Dnd.Layout panel={<MyPanel />} />
  </Live.Dnd>;
  ```

  Why: a render prop can't hold state. Every non-trivial custom panel ended up extracting a component anyway and re-passing data it had already been handed — the shipped demo's validated field, slider and headless items editor are all this shape. A component reads what it needs where it needs it.

  **Migration**

  | Before                                | After                                                                                                                                                   |
  | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `renderPalette={data => ...}`         | a component calling `useDndPalette()`, passed as `Live.Dnd.Layout`'s `palette` slot or placed in `children`                                             |
  | `renderPanel={data => ...}`           | a component calling `useDndPanel()`, passed as the `panel` slot or placed in `children`                                                                 |
  | `PaletteRenderData`                   | `DndPalette` — `{ items, onAdd }`. `DraggableItem` is now the export `Live.Dnd.DraggableItem`; `isMobile` moved to `useDndLayout()`                     |
  | `PanelRenderData`                     | `DndPanel` — same fields                                                                                                                                |
  | `<Live.Dnd.DefaultPanel {...data} />` | `<Live.Dnd.Panel />` — it reads `useDndPanel()` itself, so there's nothing left to spread and `onNodeChange` can't be dropped on the way through (#308) |
  | `Live.Dnd.DefaultLayout`              | `Live.Dnd.Layout`                                                                                                                                       |
  | `PanelProps`                          | no longer public — the built-in panel takes no data props                                                                                               |

  New in this release:

  - **`children` replaces the arrangement**, not just the content. `Live.Dnd.Palette`, `Live.Dnd.Canvas` and `Live.Dnd.Panel` are the three regions, each in the container it needs; put them wherever you want (a vertical stack, tabs, CSS grid areas) as long as they're inside `Live.Dnd`, which keeps owning the drag context they share. `Canvas` is the one that can't be replaced — it carries the droppable, the sortable list, and the scroll container each section's iframe measures itself against.
  - **`Live.Dnd.Layout` takes `palette`/`panel` slots**, so swapping one region out doesn't mean rebuilding the 3-pane Splitter and the mobile Drawers around it. A slot is placed in both the desktop pane and the mobile Drawer.
  - **`useDndLayout()`** returns the state the built-in mobile chrome runs on (`isMobile`, `selectedId`, `clearSelection`, `paletteOpen`, `setPaletteOpen`) — needed because supplying `children` replaces the floating palette button and both Drawers along with the Splitter.
  - `Palette`, `Canvas`, `Panel`, `Layout`, `useDndPalette`, `useDndPanel`, `useDndLayout`, `DndPalette`, `DndPanel`, `DndLayout`, `DndLayoutProps` and `DndRegionProps` are exported from the `dnd` subpath; the `Dnd*` types also from the package root.

  One behaviour change beyond the API: `isMobile` now follows the breakpoint rather than "am I inside the mobile Drawer" — the same value in the built-in layout, and the right one for a custom layout that puts the palette elsewhere on touch, since tap-to-add is about the input device.

  Naming: dropping the render props is also what retires the `Default` prefix. `Live.Dnd.Panel` used to be the _slot_ a panel landed in, which is why the built-in panel component had to be `DefaultPanel`. With no slot to disambiguate against, each name refers to one thing.

## 2.2.0

### Minor Changes

- 208cb1e: Export the built-in single-binding control as `Live.Dnd.Field`. A custom `renderPanel` can now mix its own controls with the built-in one per binding, instead of choosing all-or-nothing between hand-rolling every field and wrapping `DefaultPanel`.

  It's driven entirely by public render data — a `PanelBinding` out of `bindings` plus `onNodeChange` — and renders the control only, leaving the label to the caller. Most useful for `items`/`children`/`array` bindings, whose editors reach nested data-bound elements that `bindings` alone can't address.

  Also exports the `FieldProps` and `PanelNodeChange` types. `PanelNodeChange` names the node-level commit callback's shape, which was previously spelled out inline everywhere it appeared.

- 00a2a50: Forward the node-level commit callback to `renderPanel`. `PanelRenderData` now carries `onNodeChange`, so a custom panel that re-embeds `Live.Dnd.DefaultPanel` can spread the render data straight in (`<Live.Dnd.DefaultPanel {...data} />`) and keep nested array/children edits working — previously those edits were silent no-ops, affecting 5 of the 8 shipped sections (9 of Stats' 10 editable elements).

  `onNodeChange` is a required field on `PanelRenderData`. Reading it off the argument in a `renderPanel` is unaffected; only code that constructs a `PanelRenderData` object by hand (a test helper or a re-shaping wrapper) needs to add the field.

- 97daee9: Export `useItemsEditor`, the array-editing engine behind the built-in Items panel, so a custom panel can keep its own markup instead of adopting the built-in control. It returns `PanelBinding`s and position-translated actions, so it composes with `Live.Dnd.Field`: render your own layout and hand individual bindings to the built-in control where that's enough.

  It saves reimplementing the parts that are easy to get wrong — re-parsing each item's JSX to find nested data-bound elements, resolving the binding `render` map, translating visible item positions to array element positions before every edit, and reconciling the selection after a move or delete.

  Also exports the `ItemsEditor`, `ItemsEditorItem`, `ItemsEditorNestedGroup`, `ItemsEditorNestedElement`, `ItemsEditorActions` and `ItemsEditorOptions` types.

  Internally `panel/items.tsx` is now presentation over that hook (668 → 291 lines). The built-in panel's rendered markup is unchanged.

## 2.1.1

### Patch Changes

- 1adabe8: Add a `LICENSE` file (MIT) and a consumer-facing README. The README now
  documents installation, a minimal usage example with the required
  `@jbpark/live-editor/style.css` import, and the subpath entry points; the
  structure diagrams and `AGENTS.md` paths were also corrected to match the
  current source layout.

## 2.1.0

### Minor Changes

- 6c85d11: Add splitter layout for desktop view, separating palette, canvas, and panel content into resizable panels.
- c92484f: Add fallback editor for JSX-valued properties without bindings, enabling raw source editing.
- f95c347: Add curated toolbar to rich text editor, enabling bold, italic, underline, bullet list, ordered list, and link controls.
- 3bea9f4: Make `prettier` an optional peer dependency. Only the `editor` subpath uses it
  (for format-on-save), so consumers who don't need formatting no longer install
  ~9.6 MB. `useFormatCode` now loads prettier lazily and, when it's absent,
  returns the code unformatted instead of throwing. Install `prettier` (>=3)
  alongside `@jbpark/live-editor` to keep format-on-save.

### Patch Changes

- b8b130f: Declare `codemirror` as a direct dependency instead of relying on it being
  hoisted from another package, and stop masking this class of mistake: the six
  packages imported from `src` but never declared (`codemirror`, `nanoid`, and
  `@babel/parser|types|traverse|generator`) are now listed explicitly, and CI
  runs `depcheck` so an undeclared or unused dependency fails the build.
- bdc00bf: Trim published dependencies: drop the unused `uuid` runtime dependency and move
  the build-time `@tailwindcss/vite` plugin to devDependencies. Neither is
  imported from `src/`, so consumers no longer install them.
- b1372a4: Report why an `update()` failed instead of collapsing every cause into one
  `success: false`. `UpdateResult` now carries a structured `failure`
  (`element-not-found`, `no-binding`, `binding-not-declared`,
  `duplicate-binding`, `attribute-not-found`, `parse-error`), and `bulkUpdate`
  returns per-entry `failures`. The panel's error toast now names the actual
  problem — usually a wrong `property`/`label` in the element's `data-binding` —
  and only says "check the console" on paths that actually log there.

## 2.0.4

### Patch Changes

- c433b4b: Type-check `demos/` and the remaining build configs. `tsconfig.app.json` now
  includes `demos` and `tsconfig.node.json` includes `vitest.config.ts`,
  `tsdown.config.ts`, and `demos/vite.config.ts`, so `tsc -b` (and CI's type
  check) covers them instead of silently skipping ~1k LOC of demo code and three
  of the four config files.
- 0523754: Run the test suite in CI and unblock component-layer tests. `pnpm test` now
  gates both `ci.yml` and `publish.yml`, the vitest `include` glob matches
  `.test.tsx` so component tests can no longer be silently skipped, and a jsdom
  env (opt-in per file) plus Testing Library are available. Backfills tests for
  `utils/ast/tree` and `utils/ast/helpers`, and the `usePreview`/`useError`
  context guards.

## 2.0.3

### Patch Changes

- 96d2c64: Fix per-item delete/move in the array editor leaving a stale multi-select set

  The multi-select set holds positional indices. Bulk operations re-synced it after
  mutating the array, but the per-item delete/move buttons did not — and removing or
  moving an item shifts the positions of the items after it. An active selection
  silently ended up pointing at different items than the user picked, so a later bulk
  action targeted the wrong elements. The four single-item handlers (`deletePrimitive`,
  `deleteItem`, `movePrimitive`, `moveItem`) now clear the selection after they mutate,
  matching what the bulk delete already does.

- d8ed605: Fix panel text/number/date/url/asset inputs ignoring external value changes

  The panel's text-like inputs were uncontrolled (`defaultValue`), so once mounted
  they ignored later changes to their incoming value. When the source changed under
  a still-selected element — an undo/redo, or another field touching the same binding
  — the input kept showing the pre-change text, and blurring re-committed that stale
  text back into the source, clobbering the undo. The url/asset/number/textarea inputs
  now hold local live state with a render-phase reset when the canonical value changes
  (the pattern `ColorPickerField` already used), and the date picker binds the value
  directly, so the displayed value always tracks the source of truth.

- c69cc3b: Fix "process is not defined" crash when importing the published package in browsers

  `@babel/types` (bundled into the `document-*` chunk shared by the root entry and
  `@jbpark/live-editor/utils/ast`) reads `process.env.BABEL_TYPES_8_BREAKING` with
  bare, unguarded reads at module-init time. `process` doesn't exist in browsers,
  so any consumer whose bundler doesn't define it crashed on import with
  `ReferenceError: process is not defined`. `tsdown` now substitutes
  `process.env.BABEL_TYPES_8_BREAKING` (`false`) and `process.env.NODE_ENV`
  (`"production"`) at build time, so `dist` is self-contained and no consumer-side
  `process` shim is needed. Behaviour is unchanged (the flag was already falsy),
  and the dead branches tree-shake away.

## 2.0.2

### Patch Changes

- a8dba08: Move the array-item editing engine out of the panel component into `utils/ast`

  `panel/items.tsx` held an AST editing engine that mutated the `t.ObjectExpression` nodes in its own `useMemo` result, serialized the array, then mutated them back — smuggling JSX past the generator as `__JSX_<id>__` identifiers that were string-substituted into the output afterwards. That logic now lives in `src/utils/ast/items.ts` as pure string-in/string-out functions (`updateArrayItemProperty`, `updateArrayItemValue`, `moveArrayItem`, `moveArrayItems`, `removeArrayItems`, `duplicateArrayItems`, `appendArrayItem`, `parseItems`), each re-parsing the array source so nothing is shared with component state.

  The placeholder round-trip is gone: Babel prints JSX inside an object literal correctly, and a raw JSX value parses straight into a node. A value containing `$&` or `$$` can no longer be mangled by the substitution step that used to follow generation.

  Two bugs fixed along the way:

  - An `object`/`array` property was coerced to a JS value and then `String()`-ed back before parsing, so `[1, 2]` became `"1,2"` and parsed as a sequence expression. Serialized source text is now parsed directly, a real JS value is rebuilt only when the property held nothing but literals — otherwise the edit is refused rather than dropping an identifier, call or spread the evaluation could not represent — and coercion is applied only where a scalar literal is built.
  - Editing an array that mixes objects and primitives silently dropped the primitives, because the object handlers rebuilt the array from the object items alone. Every function now addresses items by their position among the array's elements.

  Also hardened: an `innerHTML` value containing a backtick, `${`, a backslash or a carriage return threw `Invalid raw` out of the edit handler or lost its line endings instead of being written verbatim, and the "don't delete the last item" guard now counts items of the kind being edited, so the object panel can no longer delete its last object just because a primitive keeps the array non-empty.

  The functions are exported from `@jbpark/live-editor/utils/ast`. `moveSelectedIndices`/`removeIndices` moved from `components/dnd/panel/selection` to `utils/selection`; they were not part of the public API.

## 2.0.1

### Patch Changes

- a1796d9: Preserve the author's formatting when editing a field, by patching source at node offsets instead of regenerating the section

  `update`/`bulkUpdate` previously mutated the AST and re-emitted the whole section through `@babel/generator`, so a single field edit reflowed the author's line breaks and indentation — including the multi-line `data-binding` declaration that drives the edit. They now record the exact source spans to change and patch the original text, leaving every untouched byte identical.

  This also removes the `__JSX_<id>__`/`__HTML_<id>__` placeholder mechanism: raw values are written straight into the source, so they no longer have to survive a generate-then-string-replace round trip, and a value containing `$&` or `$$` can no longer be mangled by it.

  No public API change — `update`, `bulkUpdate` and `UpdateResult` keep their signatures.

## 2.0.0

### Major Changes

- e9afcbe: Deliver `PanelBinding` values as their real JS type and serialize once at the AST boundary

  `PanelBinding.value` is now `unknown` — a real `number`/`boolean`/`object`/`array`/`string` rather than always a string — and a new `PanelBinding.rawValue: string` carries the exact source text. `onChange` now takes `unknown` and serializes the value a single time, at the AST boundary where the declared `type` is known, so there is no string-vs-expression guessing on either side. This fixes a string whose text begins with `{` or `[` being misclassified as a JS expression, and lets `validateBindingValue`'s `min`/`max` compare against an actual number instead of coercing a numeric string.

  Breaking change for custom `renderPanel` consumers:

  - `binding.value` is no longer a string. Use `binding.rawValue` for an `<input>` `defaultValue`, a `<select>` value, and for `flattenEditableValue`/`setEditableValue`; switch on `binding.value` for its real type.
  - `binding.onChange` accepts the value as its real type (`onChange(42)`, not `onChange('42')`).

### Minor Changes

- 820f5ba: Honor `satisfies`/`as` type annotations on authored `data-binding` arrays

  An authored `data-binding={[...] satisfies BindingItem[]}` (or `as const`, a type assertion, or extra parentheses) previously made the top-level node a `TSSatisfiesExpression`, so the array was not recognized and the whole binding was silently dropped. These build-time-erased wrappers are now unwrapped, so the inline type-safety pattern works end to end.

  Internally, `extract` now evaluates `data-binding` straight off the parsed `ArrayExpression` instead of re-serializing it and re-parsing the string — removing the redundant parse round-trip with no change to the parsed result or the value contract.

## 1.19.0

### Minor Changes

- 0537e25: Carry consumer-defined `data-binding` keys through as `BindingItem.meta`/`PanelBinding.meta` instead of silently stripping them, and degrade an unrecognized `type` inside a `render` map to untyped instead of dropping the whole entry (#234).

  `parseBinding` was designed as a sanitizer for this library's own fixed schema, not as a transport for consumer-defined data — any key on a `data-binding` entry beyond the fixed set (a step increment, a unit suffix, a group name, ...) was silently dropped, giving a custom `renderPanel` no supported way to declare its own per-field configuration. `rawBindingItemSchema` now uses `.passthrough()`, and anything it doesn't declare survives under a new, namespaced `meta?: Record<string, unknown>` field on `BindingItem`/`PanelBinding` — absent (not an empty object) when nothing extra was authored, so existing content and existing `PanelBinding` consumers see no shape change unless they actually author extra keys.

  Also fixes an inconsistency one level down: an authored `type` inside a binding's `render` map that this library doesn't recognize used to delete that key entirely, contradicting the top-level binding's own documented behavior (an unrecognized top-level `type` degrades to `undefined` rather than dropping the item). `BindingRenderLeaf.type` is now optional, matching `BindingItem.type`, so a `render` map leaf can legitimately be untyped instead of missing.

  No breaking change: both are additive, and every previously-valid `data-binding` literal still produces the same effective behavior.

## 1.18.1

### Patch Changes

- ee60074: Fix `@jbpark/ui-kit`'s bundled CSS silently overriding this library's own responsive utility classes (#259).

  `src/index.css` pulled in `@jbpark/ui-kit/style.css` as a bare `@import`, which merges the two stylesheets' identically-named `theme`/`base`/`components`/`utilities` cascade layers into one. Since ui-kit's own compiled CSS is itself a full Tailwind build, any utility class both stylesheets emit (nearly all of them, since ui-kit uses the same Tailwind utility set) resolved by import order instead of by the responsive variant actually intended to win — most visibly, `hidden md:block` (used for the built-in `Live.Dnd` panel's desktop layout) stayed hidden at any width, because ui-kit's own unconditional `.hidden` landed after `md:block` in the merged layer.

  `@import '@jbpark/ui-kit/style.css' layer(ui-kit);`, with `ui-kit` declared between `components` and `utilities` in the layer order, nests ui-kit's own layers under a dedicated `ui-kit` layer instead of merging them into this library's own. This library's own utility classes now always win over ui-kit's identically-named ones, regardless of import order, while ui-kit's internal cascade stays internally consistent.

## 1.18.0

### Minor Changes

- a439341: Export the built-in property panel as `Live.Dnd.DefaultPanel`, and `ICON_OPTIONS` alongside the existing `ICON_MAP`, so a custom `renderPanel` can wrap the built-in panel or reach icon-picker parity instead of rebuilding it from scratch (#237).

  Step 3 of #235's roadmap: the built-in panel (`field.tsx`/`node.tsx`/`panel.tsx`) used to read `DataAttrNode`/`BindingItem` directly and re-derive the exact projection `dnd.tsx` already builds as `PanelBinding[]` for a custom `renderPanel` — two implementations of the same data, which is how earlier gaps between the built-in panel and the public API (#225, #234) went unnoticed. The built-in panel now consumes `PanelBinding` throughout, the same array a `renderPanel` receives, so a field missing from the public projection breaks the library's own panel immediately instead of silently limiting a consumer's.

  - `Field` now takes a single `binding: PanelBinding` prop instead of separate `binding`/`id`/`value`/`onChange` props.
  - `Panel` (now exported as `Live.Dnd.DefaultPanel`) takes `bindings: PanelBinding[]` instead of re-parsing `DataAttrNode[]` itself.
  - `ICON_OPTIONS` (the label/value pairs the built-in icon-picker feeds its `<select>`) is now exported alongside `ICON_MAP`.

  `Items`/`Children` (array and children-list editing) are unchanged and stay on their existing node-level internals — extending them to the public `PanelBinding` surface needs `PanelBinding.value` to stop being a plain string first, which is a separate, larger change (#238). `DefaultPanel` re-embedded outside of `Dnd` itself (e.g. wrapped in a custom `renderPanel`) renders correctly but won't commit edits made through those two, since the internal callback they need for it isn't part of the public data `renderPanel` receives — documented on `DefaultPanel`'s own props and in `website/docs/custom-palette-panel.mdx`.

  No breaking change: `Field`/`Panel`'s prop shapes are internal, not previously exported, so this is additive from a consumer's perspective.

## 1.17.0

### Minor Changes

- 54d10fa: Split the binding `type` axis into `type` (data kind) + `widget` (presentation) so a custom `renderPanel` can declare its own controls (#234, #236).

  `BindingItem`/`PanelBinding` gained a `widget?: string` field, separate from
  `type`. `type` stays a closed enum describing what a value _is_ — the
  library's own validation/coercion has to be able to switch on it
  exhaustively. `widget` is deliberately just a `string`, not an enum: it
  describes how to _render_ the value, and the library can't enumerate
  controls it doesn't implement. A consumer's `renderPanel` now owns
  presentation outright by declaring and switching on any `widget` value it
  wants (e.g. `widget: 'slider'`), instead of losing that metadata to
  `parseBinding`'s zod schema the way a custom `type` string used to (#234).

  `icon-picker`/`asset-picker` — previously the only two `BindingType` values
  that actually described a control rather than a data kind — are kept as
  deprecated aliases for backward compatibility. Existing content authored as
  `data-binding={[{ type: 'icon-picker', ... }]}` keeps parsing unchanged;
  `parseBinding` now normalizes it into `{ type: 'string', widget: 'icon-picker' }`
  rather than passing `icon-picker` through as `type` directly. The built-in
  panel's icon set is now exported as `ICON_MAP` so a custom `renderPanel` can
  reuse it instead of reimplementing an icon library.

  No breaking change: `widget` is additive, and every previously-valid
  `data-binding` literal still produces the same effective behavior.

## 1.16.4

### Patch Changes

- 25996d5: Give sections a real identity so the DnD canvas stops losing track of them (#245).

  `Section.id` was modelled two incompatible ways at once. `getSections`
  re-derived it from the section's _position_ on every parse, while `Dnd` minted
  `uuidv4()` ids for sections it added or copied. A uuid was never written into
  the document, so it ceased to exist at the next parse: right after copying a
  section, `selectedId` resolved to nothing and the property panel dropped back
  to "Please select a section." Positional ids have the same flaw more generally
  — any insert, delete, copy or move silently re-points every id at or after the
  edit, which is why `moveSection` carried a hand-rolled `setSelectedId(String(targetIndex))`
  correction.

  - Sections now identify themselves with `data-id`, the same attribute editable
    elements already use. `getSections` reads it and falls back to the positional
    id for documents authored before this, so existing code keeps working
    unchanged until an edit fills the ids in.
  - New `fillSectionIds()` splices `data-id` into any top-level `<section>`
    missing one, editing the original source rather than regenerating it so the
    author's formatting is untouched everywhere else.
  - Copying a section now selects the copy, because `replaceIds` refreshes the
    section's own `data-id` too and the new id is read back from the committed
    document instead of invented.
  - Selection now survives adding, moving and reordering sections, and deleting
    a section no longer clears the selection unless it was the one deleted.
  - The `moveSection` index-arithmetic workaround is gone.

  Internally, the `replaceSections -> onChange -> setCode` commit sequence — which
  was written out seven separate times in `dnd.tsx` — is now a single
  `useSectionDocument` hook, taking `dnd.tsx` from 704 to 558 lines and making the
  section logic testable without rendering dnd-kit.

  No public API change.

## 1.16.3

### Patch Changes

- 820a5bc: Fixed `Live.Dnd` used without a `value` prop (uncontrolled usage) silently discarding every edit. `Dnd` wrote edits through `setCode` into `PreviewContext` but only ever read its canvas from the `value` prop, never from the context — so with no `value` supplied, a dragged-in section was added and then vanished on the very next render, forever re-deriving from `DEFAULT_TEMPLATE`. Mirrors the fallback `Client` (`preview/client.tsx`) already has for the same dual-source situation: `value` now resolves as `_value || code || DEFAULT_TEMPLATE`, so `<Live><Live.Dnd /></Live>` works standalone.

## 1.16.2

### Patch Changes

- 33611fb: Stop a single failing canvas section from unmounting the whole DnD editor (#246).

  `dnd/renderer.tsx` reimplemented `preview/client.tsx`'s compile-and-render
  pipeline instead of sharing it, and the two drifted: `client.tsx` wrapped the
  compiled component in an error boundary, `renderer.tsx` wrapped it in nothing.
  Since `renderer.tsx` renders every section on the canvas, a runtime error in
  any one of them propagated past `Dnd` and unmounted palette, canvas and panel —
  while the same error inside `<Preview>` was caught and displayed.

  - `renderer.tsx` now wraps each section in `Error.Boundary`, keyed on the
    section's preview string so the next edit clears a caught error without a
    remount. Errors stay local rather than going to `ErrorContext`, whose single
    `error` string would let N sections overwrite each other. `Error.Guard` is
    deliberately not used here: it listens on `window`, not on its subtree, so one
    per section would mean every section reporting any single error.
  - A section whose code fails to compile now shows a `Compile Error` panel in its
    slot instead of rendering as a silent blank, matching `client.tsx`.
  - The duplicated logic behind the drift is now shared: `useCompiledModule`
    (module merge + `compile()` + error shaping) and `useDynamicTailwind` (the
    callback-ref DOM scan, whose 12-line explanatory comment existed verbatim in
    both files) live in `preview/`, and both callers use them.

  No public API change.

## 1.16.1

### Patch Changes

- 58e2171: Fixed `update()`/`bulkUpdate()` (`@jbpark/live-editor/utils/ast`) resolving the target binding by its human-readable `label` instead of its `property` — the real identifier. Two bindings sharing a label on the same element (or a label that's been reworded/translated) used to silently collide: `.find()` picked whichever came first, the other binding's edit was dropped, and the caller still got `success: true`. `update` now accepts an optional 5th `property` argument (and `bulkUpdate`'s entries an optional `property` field) and matches on it when provided, falling back to `label` only when it isn't — and either way, more than one match on an element is now a failure (`success: false`) instead of a silent pick of the first. `Live.Dnd`'s own field-editing pipeline (the built-in panel and `PanelBinding.onChange`, used by both the built-in panel and a custom `renderPanel`) always supplies `property` now, so this collision can no longer happen through the library's own UI — only a direct `update()`/`bulkUpdate()` call that omits `property` still uses the (now safer) label fallback.

## 1.16.0

### Minor Changes

- 707e477: Added `flattenEditableValue`/`setEditableValue` (`@jbpark/live-editor/utils/ast`) — a follow-up to #225's `render`/`min`/`max`/`pattern`/`required` passthrough. `flattenEditableValue` recovers editable structure directly from a binding's current value, with no `render` map declaration required: it parses the value and, if it's an object or array, recursively walks it into one `{ path, value }` entry per primitive leaf, treating a JSX-bearing string (e.g. a further, separately data-bound nested element) as an opaque leaf rather than decomposing it further. `setEditableValue(value, path, next)` is the companion setter — it replaces just that one leaf and re-serializes the whole structure back into a string for `PanelBinding.onChange`. Together they let a custom `renderPanel` build a field-by-field editor for structured bindings (including an array of objects, like the shipped Stats/FAQ sections' `items`) without reimplementing the built-in panel's recursive decomposition, and without requiring the binding to declare a `render` map ahead of time.

## 1.15.3

### Patch Changes

- b07eea4: Fixed `renderPanel`'s `PanelBinding` silently dropping `render`, `min`, `max`, `pattern`, and `required` from each binding — a custom panel had no way to type a nested `object`/`array` key or validate a constraint, even though `validateBindingValue` was already exported for exactly that purpose. Also fixed `validateBindingValue` skipping `min`/`max` for a numeric string, which is the only form `PanelBinding.value` ever takes — the built-in panel worked around this itself with an ad-hoc `Number(next)` coercion before calling it, now removed since the exported helper handles it directly.

## 1.15.2

### Patch Changes

- dcb53e4: Bumped `@jbpark/ui-kit` from `^5.4.1` to `^5.4.4`, which fixes dark mode not applying on hosts that toggle `[data-theme='dark']` instead of the `.dark` class (5.4.3), and a `[data-slot]`-scoped preflight normalization for consumers without Tailwind preflight, so bare buttons no longer pick up the browser's default `outset` border/native `appearance`/UA font (5.4.4). Verified with a real build: `dist/style.css` includes the new `[data-slot]` normalization and `data-theme` dark-mode rules, with no bare-tag selectors leaking in.
- 50b8e1e: Fixed `Live.Dnd`'s empty-canvas placeholder always saying "Drag a component from the left to add it", even below the mobile breakpoint where the palette lives in a `Drawer` over the canvas and dragging isn't the available gesture there — only tapping is (see `draggable.tsx`'s existing `tapToAdd` handling). The message now follows the same `isMobile` condition that already drives `tapToAdd`, showing "Tap a component to add it" instead when the palette is in the drawer.

## 1.15.1

### Patch Changes

- 6b51c4f: Added `syncStyle` support to `frame.mode: 'shadow'` (previously `iframe`-only), cloning the host document's `<link>`/`<style>` tags directly into the shadow root instead of the iframe document.

  This complements `dynamicTailwind` rather than replacing it: `dynamicTailwind` recompiles whatever classes it finds in the rendered DOM at runtime, but only knows Tailwind's own default theme — a utility backed by a consuming app's custom theme token (e.g. ui-kit's `Button` rendering `bg-primary`, backed by its own `--primary` token) silently compiles to nothing, since that token doesn't exist in Tailwind's stock theme. `syncStyle` clones the host's _already-compiled_ CSS instead, which includes anything the host's own build knew about — covering custom theme tokens, at the cost of not covering a class that only appears in code typed at runtime (which `dynamicTailwind` still handles). Use both together for full coverage.

  Verified with a real build, not just code review: the docs site's `dnd`/`editor-mode`/`custom-editor` demos (embedded via `frame.mode: 'shadow'`, see #206) now render ui-kit's `Button` with its real theme color (`oklch(0.205 0 0)`, matching ui-kit's actual `--primary` token) instead of the browser's default grey — see #210.

## 1.15.0

### Minor Changes

- e8f30a2: New backward-compatible features and exports are added to the UI editor.
- 401ed3d: TypeScript source can now be compiled directly with Babel, removing the need for a separate TypeScript transpile step and eliminating the peer dependency on `typescript`.
- ee7ccea: Added per-component subpath exports — `@jbpark/live-editor/dnd`, `/editor`, `/preview`, `/provider`, and `/error` — so a consumer who only needs one feature area doesn't have to bundle every other one. The root `@jbpark/live-editor` import is unchanged.

### Patch Changes

- aa00fea: Moved `prettier` from `peerDependencies` to `dependencies`. It's an internal implementation detail (used for the editor's Cmd+S formatting), not something consumers were meant to supply their own version of — a missing peer previously made the whole package fail to load under package managers that don't auto-install peers (pnpm, yarn).
- ee7ccea: Declared `sideEffects` in `package.json` (scoped to CSS files) so bundlers can safely tree-shake unused exports from the package entry instead of conservatively retaining everything.
- 4de89fa: Bumped `@jbpark/ui-kit` from `^5.3.0` to `^5.4.1`, which fixes `@jbpark/ui-kit/style.css` shipping Tailwind's preflight (a document-wide reset that flattened a host page's typography — see #207) and a follow-up regression where some ui-kit components lost their own list/margin reset. Verified with a real build: `dist/style.css` no longer contains any bare-tag rules, and loading it on a host page leaves `h1`/`p`/`body` styling untouched.
- db13065: Fixed `dynamicTailwind` (on `Live.Preview`/`Live.Dnd`) silently producing no
  usable CSS under `frame.mode: 'shadow'`, two separate bugs stacked together:

  - `Live.Dnd`'s `Renderer` had no `dynamicTailwind` support at all — only
    `Live.Preview`'s `Client` did, so a `Dnd` rendered in `shadow` mode had no
    way to get any utility-class styling into the shadow root.
  - The Tailwind compile context (`generateTailwindCSS`, used by both) never
    loaded Tailwind's theme layer, so any utility depending on a theme token —
    `text-white`, `text-5xl`, `px-5`, essentially anything beyond
    keyword-only utilities like `text-center` — silently compiled to nothing.
  - Switched from regex-scanning the previewed source text to scanning the
    actual rendered DOM after mount (`generateTailwindCSSFromDOM`), so classes
    contributed by an imported component (e.g. ui-kit's `Button` rendering its
    own `bg-primary`) are picked up too, not just literal `className`/`cn(...)`
    usage in the code itself.

  This unblocks the docs site's `dnd`, `custom-palette-panel`, `editor-mode`,
  and `custom-editor` demos, which were rendering as blank/unstyled content
  when embedded (see #206) because they run inside a doubly-nested sandboxed
  iframe, where `iframe` mode's own isolation strategy doesn't work — they now
  use `frame.mode: 'shadow'` with `dynamicTailwind` instead, which doesn't
  depend on the sandboxed iframe's own nested-iframe capability at all.

  Known remaining gap, tracked separately: `dynamicTailwind`'s DOM scan only
  knows Tailwind's own default theme, not a consuming app's custom theme
  extensions — a `bg-primary` utility backed by a project-specific
  `--color-primary` token (as ui-kit's `Button` uses) won't resolve.

- ee7ccea: Corrected `peerDependencies.typescript` from `~5.8.3` to `~6.0.3` to match the version this package actually builds and tests with — the old range excluded a TypeScript version that would otherwise satisfy it for any real consumer.
- 57a210f: Fixed `Live.Preview` silently ignoring the `frame` prop whenever a `code` prop was also passed — `code` and `frame` previously took two divergent render paths, and only one of them wrapped its output in `<Frame>`. `dynamicTailwind` also now works together with `frame`, which it couldn't before this fix.
- f6f2daa: `@jbpark/ui-kit`'s stylesheet is now pulled in via `@import` at the CSS level (bundled into `dist/style.css`) instead of a JS-side `import '@jbpark/ui-kit/style.css'` that survived unresolved into `dist/index.js`. Consumers following the documented `import '@jbpark/live-editor/style.css'` see no change; consumers whose toolchain couldn't handle a raw CSS import out of `node_modules` (plain Node, non-CSS-aware bundlers) can now import the JS entry without that failing.

## 1.14.0

### Minor Changes

- 57d78b5: The live editor now correctly handles viewport units in inline styles and author <style> elements, ensuring they resolve against the fixed probe height rather than the iframe's own height.

### Patch Changes

- 69e7e5c: Tailwind CSS is now imported without its global preflight layer, allowing host pages to maintain their own spacing and typography settings.

## 1.13.0

### Minor Changes

- 71de287: Let a custom `renderPanel` build its own field controls. `PanelRenderData` now includes `bindings` — the selected section's editable `data-binding` fields flattened to one entry per bound property, each carrying its `type`, current `value`, `options` (when present), and an `onChange` wired straight into the same AST-update pipeline the built-in panel uses (including the error Toast on a bad edit). Consumers switch on `binding.type` to render their own `<input>` / `<textarea>` / `<select>` (or any control) instead of being handed a fixed field editor.

  This replaces the earlier `fields` / `onFieldChange` / `FieldEditor` render-prop shape from the same unreleased cycle: rather than exposing the built-in `FieldEditor` component (and the raw `DataAttrNode[]` behind it), `renderPanel` now hands over plain, ready-to-render binding data, so a custom panel never has to touch `DataAttrNode` / `parseBinding` / `getCurrentValue` itself. The field-extraction logic still lives in `Dnd` (moved up out of `Panel`), so the built-in panel and a custom `renderPanel` share one implementation.

- b61a3d4: Add Move up/Move down buttons to the section properties panel, next to Delete. Dragging to reorder doesn't work from inside the mobile Components/Properties Drawer — the canvas sits behind it, so there's nothing visible to drag onto — so this gives an explicit alternative that works regardless of layout. Added a matching `onMoveUp`/`onMoveDown`/`canMoveUp`/`canMoveDown` on `PanelRenderData` for custom `renderPanel` implementations.

  Also fixes a latent bug this surfaced: section `id`s are derived fresh from each section's position on every parse, not a stable identity, so reordering the selected section left `selectedId` pointing at whatever content ended up at its old position instead of following it. The new move buttons now correctly keep the moved section selected.

### Patch Changes

- d10cb98: Remove the `antd` and `@ant-design/icons` dependencies. Neither was used by the published package (`dist` imports only `@jbpark/ui-kit`) — they were pulled in solely by the demo editor page, so consumers were installing both for nothing. The demo's toolbar now uses `@jbpark/ui-kit` (`Button`, `Radio`, `Space`, `Splitter`, `Toast`) and `lucide-react` icons instead, matching the rest of the codebase, and both antd packages are dropped from `dependencies`.
- 03d88f7: Hide the inner scrollbar of `autoHeight` iframes. Because `autoHeight` sets the iframe's height to `Math.ceil(contentHeight)`, sub-pixel content or a rounding remainder could leave the document a fraction taller than its viewport — enough for the browser to draw a vertical scrollbar inside the iframe. In Dnd mode, where every section renders its own `autoHeight` iframe, this showed up as a stray scrollbar on each stacked section. A persistent `scrollbar-width: none` / `::-webkit-scrollbar { display: none }` style now hides only the chrome (not scrolling itself, so content that ever genuinely exceeds the measured height stays reachable), and is removed again if `autoHeight` is turned off.
- c4419c8: Fix the same `@babel/*` CJS/ESM interop bug (#145) in `@babel/generator`: `import generate from '@babel/generator'` resolved to the whole `{ default, generate, CodeGenerator }` exports object instead of the function under Vite's browser bundling. `extractAttributes()` silently swallowed the resulting `TypeError` into a `null` attribute value, so any JSX-expression-valued attribute (e.g. `data-binding={[...]}`) came back empty — selecting a section on the canvas showed no editable fields (or an error toast, when the failure surfaced elsewhere in the update path). Also moved `extract.ts`/`update.ts` off their own direct `@babel/traverse` imports to share `document.ts`'s already-fixed binding, instead of each carrying the same fix independently.
- 0ee8505: Build the package for the browser (`platform: 'browser'` in `tsdown.config`). Without an explicit browser platform, bundled dependencies resolved their Node conditions — e.g. `nanoid` pulled in `crypto.randomFillSync`, and CJS interop injected `createRequire` from `node:module` — so the published package threw in every browser bundler that consumed it (rspack/webpack reject `node:` scheme imports). This also aligns the emitted extensions with the `exports` map (`.js` / `.d.ts`).
- 26864dd: Fix the package `exports`, `module`, and `types` fields to point at the files the build actually emits. They still referenced a pre-`tsdown` layout (`./dist/index.js`, `./dist/utils.js`, `./dist/live-editor.css`, `.d.ts`), and while the entry names were corrected, the extensions must match what `tsdown` emits under `platform: 'browser'` — `./dist/index.js`, per-entry `./dist/utils/index.js` / `./dist/utils/ast/index.js` / `./dist/utils/tailwind/index.js`, `./dist/style.css`, and `.d.ts` declarations. As a result, importing the package by name (`@jbpark/live-editor`, `/utils`, `/utils/ast`, `/utils/tailwind`, `/style.css`) failed to resolve for any consumer — the in-repo Vite demo only worked because it imports via the `~/.` source alias, sidestepping the package entry entirely. All five export subpaths now resolve against the real build output.
- 8af847f: Fix a broken `@babel/traverse` import that made `parseDocument` throw on every call in the browser (`TypeError: traverse is not a function`), silently breaking drag-and-drop entirely — nothing could ever be added to the canvas. `@babel/traverse`'s CJS build re-exports itself as `{ default: traverse, ...rest }`, and Vite's dependency pre-bundling doesn't unwrap that inner `default` a second time when re-exporting for ESM, so the plain `import traverse from '@babel/traverse'` resolved to the whole exports object instead of the function. Vitest's Node-based module resolution didn't hit this, so it went undetected by the test suite despite being broken in every real browser build, dev and production alike.

  Also added a `tapToAdd` mode to the built-in drag palette (and a matching `isMobile` field on `PaletteRenderData` for custom `renderPalette` implementations): the mobile palette Drawer now adds a component on a single tap instead of requiring a double-tap. Double-click-to-add stays desktop-only, where it exists specifically to distinguish a deliberate add from an aborted drag attempt — a distinction that doesn't apply inside the Drawer, since there's nothing to drag onto there.

## 1.12.0

### Minor Changes

- b7cfdd9: 전체 의존성 최신화(`@jbpark/ui-kit` 5.0→5.3, `@jbpark/use-hooks` 3.0→4.0.1, antd, `@tiptap/*`, react-router-dom, uuid, `@codemirror/*` 등)와 그에 따른 호환성 수정. 공개 API 변경은 없음 — GitHub 아이콘을 인라인 SVG로 교체(lucide-react v1이 브랜드 아이콘 제거), 에디터 undo/redo 상태 동기화를 렌더 중 조정 패턴으로 전환.

## 1.11.0

### Minor Changes

- e4ac79d: Added debouncing to ColorPicker's onChange to improve performance and prevent visual snapping back to the last committed color between debounced commits.
- c2f49f1: The live editor now correctly measures the height of nested overlays and position:fixed/absolute elements, avoiding previously introduced issues with content being invisible or clipped.
- f0134e5: Added support for cq\*-unit content in preview iframe, enabling correct sizing against the viewport's height.
- 5d2e37c: Rewrite vh/svh/lvh/dvh/vmin/vmax units to cqh/cqmin/cqmax equivalents in CSS dimensions, including nested inside calc()/var() fallbacks, while preserving vw and custom property names.
- 2e109b4: Added a cache to reuse section previews when their code and container context haven't changed, improving performance in the drag-and-drop panel.

## 1.10.0

### Minor Changes

- 197115f: Added a renderEditor render prop to Editor, letting consumers fully replace the built-in CodeMirror editing surface with their own implementation while still syncing to the shared preview code automatically. Exposes formatCode (the same prettier-based formatting Core's Cmd+S uses) so a custom editor can offer equivalent format-on-save behavior.

## 1.9.0

### Minor Changes

- 94de0ec: usePreview/useError now throw a clear error when used without a `<Live>` ancestor instead of silently no-op'ing (this is a behavior change for any code that was relying on the silent no-op — please verify all usages are correctly wrapped). Also memoized ContextProvider's Provider values so consumers only re-render when code/error actually change.
- 3c0a2ac: Added renderPalette/renderPanel props to Dnd, letting consumers fully replace the built-in left component-palette and right property-panel with custom markup while drag-and-drop and field editing keep working. Also exported DraggableItem (Dnd.DraggableItem), a children-render-prop component that owns the drag wiring for custom palette items.

### Patch Changes

- 675e112: Internal refactor: adopted @jbpark/use-hooks 3.0.0's useKeyPress, useResizeObserver, useMutationObserver, useEventListener, and useDebouncedValue in place of hand-rolled window/DOM listener wiring in the editor shortcut handling, iframe auto-height/style-sync, error listeners, and debounced code commits. No intended behavior change.

## 1.8.1

### Patch Changes

- d776d47: Fixed ErrorBoundary (and Preview's own runtime-error state) staying stuck on a stale error screen after the underlying code was fixed. ErrorBoundary gained an optional resetKeys prop, but this is a backward-compatible fix — every real usage in Preview/Client now auto-recovers without any consumer action needed.
- 274e4e6: Fixed the runtime/compile error overlay staying up indefinitely after the underlying code was fixed. ContextProvider's setCode now clears the stale error in the same update that changes the code.
- 4b0cb33: Fixed a race condition where rapid code edits could let a stale Tailwind CSS generation request overwrite the current one, and fixed dynamically-generated CSS staying injected after turning dynamicTailwind off.
- 6d314f2: Hardened Preview and the DnD renderer's compile() calls with try/catch, matching Client's existing defensive pattern, so a future regression in compileModule can't crash the whole tree instead of falling back to the existing error UI.
- 151f377: Fixed the iframe frame not loading new scripts after the scripts prop changed post-initial-load, and fixed removed styles/stylesheets staying injected in the iframe instead of being cleaned up.
- cc78d04: Fixed click/pointerdown/pointerup events being handled twice by listeners outside a shadow-mode frame. Shadow no longer manually redispatches these events on the host, since they already cross the shadow boundary on their own (composed: true).

## 1.8.0

### Minor Changes

- 8863b68: Improve the diffing and replacement of document sections, preserving non-section content and wrapper elements when sections are reordered or deleted.

### Patch Changes

- 0f40104: Fixed 7 confirmed bugs: Guard's onError prop being shadowed and never invoked, Field's blur handlers blocking clearing a value to empty, extractNodeValue not recognizing negative numeric literals, Items crashing when adding an item to an empty array, createBoundedCache not calling onEvict on overwrite/delete/clear, scriptCache sharing an unrelated cache's size limit, and compile()'s cache key using a collision-prone 32-bit hash.

## 1.7.0

### Minor Changes

- b8b002b: The editor now has a smaller memory footprint when editing large documents, with a separate cache limit for document ASTs to prevent unnecessary memory usage.

## 1.6.0

### Minor Changes

- a1e6443: Added support for batched generation of section previews, improving performance when multiple sections change.
- c2719ab: The editor now correctly handles nested sections, preserving non-section content and not reformatting code outside the replaced section span.

## 1.5.0

### Minor Changes

- 4b258e0: Add a welcome landing page intro view and integrate Toast notifications for item parsing errors.
- e2ba1af: Add a delete button to the drag-and-drop panel to allow removing sections directly from the editor.
- daaf167: Add support for parsing and manipulating JSX documents, including extracting sections, replacing sections, and generating section previews.
- a4079f1: Added bounded caching to improve performance by limiting the number of cached items and evicting the oldest entry when the limit is reached.
- da1b700: Added caching to improve performance of document parsing, allowing for repeated parses of the same source string without re-lexing and re-parsing from scratch.

### Patch Changes

- c41a7f3: Improve state synchronization in the preview page by utilizing the local storage hook for persistent code viewing.
- 63f9420: Fix false-positive TypeScript detection for ES module import and export aliasing syntax.

## 1.4.0

### Minor Changes

- 7122002: Type the `data-binding` JSX attribute as `BindingItem[]`, giving editor autocomplete and compile-time errors while authoring binding configs instead of silent runtime failures.

## 1.3.0

### Minor Changes

- d20abbe: Add a project intro page at "/" with the title, tagline, highlights, and links to the editor/GitHub/npm. The interactive editor moved from "/" to "/editor".
- 0dca09e: Fix a CSS cascade-order bug that permanently hid the Dnd builder's palette/properties columns on desktop, regardless of viewport width. Also fixes the underlying `.prettierrc` import-sort regex that was silently undoing the fix on every format run.
- 8abd8a9: Make the Editor-mode Preview/CodeMirror Splitter responsive: it now stacks vertically on mobile instead of staying side-by-side.

## 1.2.0

### Minor Changes

- 411ea7d: Remove the Desktop/Tablet/Mobile viewport-size preset toggle and custom width input from the editor toolbar.
- 23133d5: Fix evaluateLiteral to correctly parse JSON-stringified object keys, fixing data loss when moving or editing items in the Children panel.
- b96f003: Refactor the data-binding config parser to validate/normalize via Zod schemas instead of manually walking Babel AST nodes field by field, and derive the allowed binding type list from a single source of truth shared with the type definitions.
- f31e36f: Make the drag-and-drop builder responsive on mobile: the canvas is now full-width, and the component palette and properties panel open as bottom drawers instead of fixed side columns.

## 1.1.0

### Minor Changes

- 39a40e7: Add multi-select and bulk operations (duplicate, move up/down, delete) to `Panel/Items` and `Panel/Children`, resolving #34. Checkbox-select individual rows or shift-click for range-select; a bulk actions bar appears once anything is selected. Bulk delete/duplicate/move are implemented by generalizing the existing single-item mutation functions (`deleteItem`, `moveItem`, etc.) to operate on an index set rather than introducing a parallel code path. Selection state comes from `@jbpark/use-hooks`'s new `useMultiSelect` (bumped to `^2.7.0`) rather than a local copy, since the same hook is now shared with other list-selection UIs.
- 39a40e7: Introduce bulk actions for selected items in the drag-and-drop panel, allowing users to duplicate, move, and delete multiple items at once.
- fb87068: Add viewport presets and custom width input for responsive design in the editor.
- fb87068: Add a viewport-size toggle (Desktop/Tablet/Mobile presets + custom width input) to the demo app's toolbar, resolving #35. Applied by composing `frame.style.width` on the existing `Live.Preview`/`Live.Dnd` `frame` prop — no changes to `Frame`/`IFrame` themselves.

## 1.0.1

### Patch Changes

- 47d5199: No functional changes. Bump past `1.0.0`, which npm permanently refuses to accept (a previously-unpublished exact version number cannot be republished).

## 1.0.0

### Major Changes

- e037141: Refactor component structure and file organization, changing import paths and renaming files to lowercase, which may affect existing imports.
- 21d0f5b: Introduce new binding types for date, URL, icon-picker, and asset-picker, enhancing the field component with new input options and validation.

### Minor Changes

- e61e1d2: Add undo and redo functionality to the editor with keyboard shortcuts and buttons.
- e9e0673: Introduce useLocalStorage hook for managing saved values, enhancing state persistence.
- 2d11b4b: Add validation for binding values with min, max, pattern, and required constraints in the Field component.
- 21d0f5b: Replace the inline `date` and `asset-picker` binding field implementations with `@jbpark/ui-kit`'s `DatePicker` and `Upload` components (bumped `@jbpark/ui-kit` to `^3.2.0`). `asset-picker` now keeps the existing URL text input alongside a drag-and-drop `Upload` for local files, both writing to the same binding value. `icon-picker` is unchanged and stays a local implementation (`icon-map.ts` is still in active use).

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.0

### Minor Changes

- b622c6b: Introduce evaluateLiteral function to convert AST nodes to pure literal values without executing code, enhancing the handling of object and array expressions.
- 0468952: Prevent incorrect replacements in JSX placeholders by using function-based replacements to handle special characters.
- 85c3395: Introduce new binding properties and improve the handling of data attributes in the drag-and-drop panel.

## 0.1.0

### Minor Changes

- Add commit message generation feature
- Add publish checklist
- Add changelog auto-update workflow
- Change CI/CD configuration

### Patch Changes

- Remove .changeset/README.md
- Remove changeset config files
- Remove commit message generation guide (English)
- Remove commit message generation guide (Korean)
- Remove commit message convention
