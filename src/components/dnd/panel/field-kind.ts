import { BINDING_PROP } from '~/constants';

import type { PanelBinding } from '../panel-binding';

// Which built-in control `Field` renders for a binding. `BuiltinField`
// dispatches on this, so a custom panel that asks the same question (most
// often "does this binding need a structural editor?") gets the library's
// answer rather than a copy of it that can drift.
export type FieldKind =
  // `canEditValue: false` — shown as preserved source, not editable.
  | 'readonly'
  // An array literal (`items`/`data` or `type: 'array'`) — the Items editor,
  // or `useDndItems` for your own markup.
  | 'items'
  // Element children given as extracted nodes — the Children editor, or
  // `useDndChildren` for your own markup.
  | 'children'
  | 'richtext'
  | 'jsx'
  | 'html'
  // A plain object value — one nested field per key.
  | 'object'
  | 'boolean'
  | 'select'
  | 'color'
  | 'date'
  | 'url'
  | 'number'
  | 'text';

export type FieldKindBinding = Pick<
  PanelBinding,
  'property' | 'type' | 'value' | 'options' | 'canEditValue'
>;

const isColorProperty = (property: string): boolean =>
  property.toLowerCase().includes('color');

// Order matters: the first match wins, exactly as the built-in control
// chooses. `renderField` runs before any of this and can replace the result,
// so this describes the built-in control, not what a `renderField` override
// draws.
export const getFieldKind = (binding: FieldKindBinding): FieldKind => {
  const { property, type, value } = binding;

  if (binding.canEditValue === false) {
    return 'readonly';
  }

  if (property === 'items' || property === 'data' || type === 'array') {
    return 'items';
  }

  if (type === 'richtext') {
    return 'richtext';
  }

  if (property === BINDING_PROP.INNER_HTML) {
    return 'html';
  }

  if (type === 'jsx') {
    return 'jsx';
  }

  if (property === 'children' && Array.isArray(value)) {
    return 'children';
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return 'object';
  }

  if (type === 'boolean' || typeof value === 'boolean') {
    return 'boolean';
  }

  if (binding.options && Array.isArray(binding.options)) {
    return 'select';
  }

  if (type === 'color' || isColorProperty(property)) {
    return 'color';
  }

  if (type === 'date') {
    return 'date';
  }

  if (type === 'url') {
    return 'url';
  }

  if (type === 'number' || typeof value === 'number') {
    return 'number';
  }

  return 'text';
};

// True for the two kinds whose value holds further data-bound elements, so a
// flat input can't edit them: route these to `Field` or to the matching hook.
export const isStructuralFieldKind = (
  kind: FieldKind,
): kind is 'items' | 'children' => kind === 'items' || kind === 'children';
