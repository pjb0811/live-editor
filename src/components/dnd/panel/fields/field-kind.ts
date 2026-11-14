import { BINDING_PROP } from '~/constants';

import { type PanelBinding, isArrayBinding } from '../../panel-binding';

// Which built-in control `Field` renders for a binding. Exported so a
// custom panel can ask the same question, most often whether a binding
// needs a structural editor.
export type FieldKind =
  // `canEditValue: false` — shown as preserved source, not editable.
  | 'readonly'
  // An array literal (`type: 'array'`, or `items`/`data` unless typed or
  // valued as an object) — the Items editor, or `useDndItems` for your own
  // markup.
  | 'items'
  // Element children given as extracted nodes — the Children editor, or
  // `useDndChildren` for your own markup.
  | 'children'
  | 'richtext'
  | 'jsx'
  | 'html'
  // A function prop's source (`type: 'function'`) — a code editor. With
  // `options` and a listed or empty value, `'select'` instead (#741).
  | 'function'
  // A plain object value — one nested field per key.
  | 'object'
  | 'boolean'
  | 'select'
  | 'color'
  | 'date'
  | 'time'
  | 'datetime'
  | 'url'
  | 'email'
  | 'tel'
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

  // A select only while the value is one of the options, or empty: an
  // inline function written in the code editor would otherwise show as the
  // first option.
  if (type === 'function') {
    const isListed =
      Array.isArray(binding.options) &&
      (value === '' || binding.options.some(option => option.value === value));

    return isListed ? 'select' : 'function';
  }

  if (isArrayBinding(binding)) {
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

  if (type === 'time') {
    return 'time';
  }

  if (type === 'datetime') {
    return 'datetime';
  }

  if (type === 'url') {
    return 'url';
  }

  if (type === 'email') {
    return 'email';
  }

  if (type === 'tel') {
    return 'tel';
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
