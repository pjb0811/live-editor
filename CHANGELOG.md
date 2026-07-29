# Changelog

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
