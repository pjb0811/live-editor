# Changelog

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
