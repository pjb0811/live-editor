import { BINDING_PROP } from '~/constants';

import type { PanelBinding } from '../panel-binding';

// Which built-in control `Field` renders for a binding. Exported so a
// custom panel can ask the same question, most often whether a binding
// needs a structural editor.
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

// The first match wins. Describes the built-in control only: `renderField`
// runs first and can replace it.
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
