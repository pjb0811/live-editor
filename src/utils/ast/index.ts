// The public `./utils/ast` entry: reading a section's bindings (`extract`),
// committing edits (`update`, `updateAll`), validating and flattening
// values, and the types those take and return. Library code imports from
// the module files, not from here (#522).

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
} from './editable-value';
export { parseValue } from './value';
export { flattenEditableValue, setEditableValue } from './editable-value';
export { extract } from './extract';
export type {
  DocumentOptions,
  DocumentProblem,
  SectionOptions,
} from './document';
export { update, updateAll } from './update';
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
