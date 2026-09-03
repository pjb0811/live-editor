# Changelog

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
