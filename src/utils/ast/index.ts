// The public `./utils/ast` entry: reading a section's bindings (`extract`),
// committing edits (`update`, `updateAll`), validating and flattening
// values, and the types those take and return. Library code imports from
// the module files, not from here, so the deprecated names below can leave
// this barrel without touching their callers (#522).
import { canStructurallyEditArray as _canStructurallyEditArray } from './array-source';
import { getCurrentValue as _getCurrentValue } from './binding';
import { getStructuredValue as _getStructuredValue } from './binding';
import { parseBinding as _parseBinding } from './binding';
import { parseBindingExpression as _parseBindingExpression } from './binding';
import { readNodeBindings as _readNodeBindings } from './binding';
import { resolveBindings as _resolveBindings } from './binding';
import { getKeyBindings as _getKeyBindings } from './binding';
import { getRegistryBindings as _getRegistryBindings } from './binding';
import { isComponentTagName as _isComponentTagName } from './binding';
import { clearExtractCache as _clearExtractCache } from './extract';
import { generateCode as _generateCode } from './helpers';
import { appendArrayItem as _appendArrayItem } from './items';
import { duplicateArrayItems as _duplicateArrayItems } from './items';
import { moveArrayItem as _moveArrayItem } from './items';
import { moveArrayItems as _moveArrayItems } from './items';
import { parseItems as _parseItems } from './items';
import { removeArrayItems as _removeArrayItems } from './items';
import { updateArrayItemProperty as _updateArrayItemProperty } from './items';
import { updateArrayItemValue as _updateArrayItemValue } from './items';
import type { ArrayItem as _ArrayItem } from './items';
import type { ItemKind as _ItemKind } from './items';
import { fillIds as _fillIds } from './tree';
import { replaceIds as _replaceIds } from './tree';
import { clone as _clone } from './tree';
import type { ExtractedNodeValue as _ExtractedNodeValue } from './types';
import type { NodeValueType as _NodeValueType } from './types';
import type { EditableNodeValueType as _EditableNodeValueType } from './types';
import { parseArrayExpression as _parseArrayExpression } from './value';
import { arrayExpressionToCode as _arrayExpressionToCode } from './value';
import { extractNodeValue as _extractNodeValue } from './value';
import { extractObjectProperties as _extractObjectProperties } from './value';
import { createNodeFromValue as _createNodeFromValue } from './value';
import { canLosslesslyEvaluateSource as _canLosslesslyEvaluateSource } from './value';

export type {
  BindingFieldSpec,
  BindingItem,
  BindingOption,
  BindingRenderLeaf,
  BindingComponentName,
  BindingKeyMap,
  BindingOptions,
  BindingRegistry,
  BindingRenderMap,
  BindingSchema,
  BindingType,
  BindingWidget,
  DataAttrNode,
} from './types';
export { findEditableChildren } from './binding';
export type {
  EditablePathSegment,
  EditablePrimitive,
  EditableValueEntry,
} from './value';
export { flattenEditableValue, parseValue, setEditableValue } from './value';
export { extract } from './extract';
export type {
  DocumentOptions,
  DocumentProblem,
  SectionOptions,
} from './document';
export { bulkUpdate, update, updateAll } from './update';
export type {
  UpdateAllResult,
  UpdateEntry,
  UpdateFailure,
  UpdateResult,
} from './update';
export { getChildrenSignatures } from './children';
export type { ChildrenAction, ChildrenEdit } from './children';
export type {
  ValidationMessages,
  ValidationOptions,
  ValidationResult,
} from './validate';
export { defaultValidationMessages, validateBindingValue } from './validate';

// Internal helpers this entry used to export. Each still works, and leaves
// the entry in the next major (#522). Most are `const` aliases, so their
// `@deprecated` reaches the built declarations. The document layer stays a
// plain re-export: as an alias here, its Babel AST types move this entry's
// declarations into the chunk that also pulls in React, and
// `check-package-types.mjs` fails. A re-export's JSDoc doesn't survive the
// declaration bundle, so those are announced in the docs and changeset only.

// Array-literal editing: the engine behind `useDndItems`.
/** @deprecated Internal. Use `useDndItems` from `./dnd`. Removed in the next major. */
export const appendArrayItem = _appendArrayItem;
/** @deprecated Internal. Use `useDndItems` from `./dnd`. Removed in the next major. */
export const duplicateArrayItems = _duplicateArrayItems;
/** @deprecated Internal. Use `useDndItems` from `./dnd`. Removed in the next major. */
export const moveArrayItem = _moveArrayItem;
/** @deprecated Internal. Use `useDndItems` from `./dnd`. Removed in the next major. */
export const moveArrayItems = _moveArrayItems;
/** @deprecated Internal. Use `useDndItems` from `./dnd`. Removed in the next major. */
export const parseItems = _parseItems;
/** @deprecated Internal. Use `useDndItems` from `./dnd`. Removed in the next major. */
export const removeArrayItems = _removeArrayItems;
/** @deprecated Internal. Use `useDndItems` from `./dnd`. Removed in the next major. */
export const updateArrayItemProperty = _updateArrayItemProperty;
/** @deprecated Internal. Use `useDndItems` from `./dnd`. Removed in the next major. */
export const updateArrayItemValue = _updateArrayItemValue;
/** @deprecated Internal. Use `useDndItems` from `./dnd`. Removed in the next major. */
export const parseArrayExpression = _parseArrayExpression;
/** @deprecated Internal. Use `useDndItems` from `./dnd`. Removed in the next major. */
export const arrayExpressionToCode = _arrayExpressionToCode;
/** @deprecated Internal. Use `useDndItems` from `./dnd`. Removed in the next major. */
export const canStructurallyEditArray = _canStructurallyEditArray;
/** @deprecated Internal. Use `useDndItems` from `./dnd`. Removed in the next major. */
export type ArrayItem = _ArrayItem;
/** @deprecated Internal. Use `useDndItems` from `./dnd`. Removed in the next major. */
export type ItemKind = _ItemKind;

// Value plumbing behind `extract`, `update` and `PanelBinding.value`.
/** @deprecated Internal. Read values through `extract` or `PanelBinding.value`. Removed in the next major. */
export const extractNodeValue = _extractNodeValue;
/** @deprecated Internal. Read values through `extract` or `PanelBinding.value`. Removed in the next major. */
export const extractObjectProperties = _extractObjectProperties;
/** @deprecated Internal. Write values through `update` or `PanelBinding.onChange`. Removed in the next major. */
export const createNodeFromValue = _createNodeFromValue;
/** @deprecated Internal. Check `PanelBinding.canEditValue` instead. Removed in the next major. */
export const canLosslesslyEvaluateSource = _canLosslesslyEvaluateSource;
/** @deprecated Internal. Read values through `extract` or `PanelBinding.value`. Removed in the next major. */
export const getCurrentValue = _getCurrentValue;
/** @deprecated Internal. Read values through `extract` or `PanelBinding.value`. Removed in the next major. */
export const getStructuredValue = _getStructuredValue;
/** @deprecated Internal. Removed in the next major. */
export type ExtractedNodeValue = _ExtractedNodeValue;
/** @deprecated Internal. Removed in the next major. */
export type NodeValueType = _NodeValueType;
/** @deprecated Internal. Removed in the next major. */
export type EditableNodeValueType = _EditableNodeValueType;

// Binding resolution behind `extract(source, { bindings, bindingKeys })`.
/** @deprecated Internal. Read bindings through `extract` or `useDndPanel().bindings`. Removed in the next major. */
export const parseBinding = _parseBinding;
/** @deprecated Internal. Read bindings through `extract` or `useDndPanel().bindings`. Removed in the next major. */
export const parseBindingExpression = _parseBindingExpression;
/** @deprecated Internal. Read bindings through `extract` or `useDndPanel().bindings`. Removed in the next major. */
export const readNodeBindings = _readNodeBindings;
/** @deprecated Internal. Read bindings through `extract` or `useDndPanel().bindings`. Removed in the next major. */
export const resolveBindings = _resolveBindings;
/** @deprecated Internal. Read bindings through `extract` or `useDndPanel().bindings`. Removed in the next major. */
export const getKeyBindings = _getKeyBindings;
/** @deprecated Internal. Read bindings through `extract` or `useDndPanel().bindings`. Removed in the next major. */
export const getRegistryBindings = _getRegistryBindings;
/** @deprecated Internal. Removed in the next major. */
export const isComponentTagName = _isComponentTagName;

// The document layer under `./utils` and `Live.Dnd`.
export {
  /** @deprecated Internal. Use `extractSections` from `./utils`. Removed in the next major. */
  parseDocument,
  /** @deprecated Internal. Use `extractSections` from `./utils`. Removed in the next major. */
  getSections,
  /** @deprecated Internal. Use `replaceSections` from `./utils`. Removed in the next major. */
  replaceDocumentSections,
  /** @deprecated Internal. Use `checkDocument` from `./utils`. Removed in the next major. */
  inspectDocument,
  /** @deprecated Internal. Removed in the next major. */
  generateDocumentCode,
  /** @deprecated Internal. Removed in the next major. */
  fillSectionIds,
  /** @deprecated Internal. Removed in the next major. */
  generateSectionPreview,
  /** @deprecated Internal. Removed in the next major. */
  generateSectionPreviews,
  /** @deprecated Internal. Removed in the next major. */
  createSectionPreviewCache,
} from './document';
export type {
  /** @deprecated Internal. Use `checkDocument` from `./utils`. Removed in the next major. */
  DocumentInspection,
  /** @deprecated Internal. Removed in the next major. */
  DocumentTree,
  /** @deprecated Internal. Removed in the next major. */
  SectionPreviewCache,
} from './document';

// Ids, code generation and caches.
/** @deprecated Internal. Removed in the next major. */
export const fillIds = _fillIds;
/** @deprecated Internal. Removed in the next major. */
export const replaceIds = _replaceIds;
/** @deprecated Internal. Removed in the next major. */
export const clone = _clone;
/** @deprecated Internal. Removed in the next major. */
export const generateCode = _generateCode;
/** @deprecated Internal. Use `clearEditorCaches` from `./utils`. Removed in the next major. */
export const clearExtractCache = _clearExtractCache;
export {
  /** @deprecated Internal. Use `clearEditorCaches` from `./utils`. Removed in the next major. */
  clearDocumentParseCache,
} from './document';
