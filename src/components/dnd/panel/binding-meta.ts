import type { DndPanelLayout } from '../edit-options';
import type { PanelBinding } from '../panel-binding';

// The `meta` keys the docs suggest for the panel, read only by what a host
// opts into: `metaPanelLayout` for the built-in panel, or these functions in
// a custom one (#753, #763). The core reads none of them.

// Shows a field only while another binding's value is one of `in`.
export interface VisibleRule {
  // The binding this field depends on.
  property: string;
  // That binding's element, its `data-id`, when it isn't this field's own.
  id?: string;
  // Show while the value is one of these. An array value shows while any of
  // its entries is.
  in: unknown[];
  // The value to assume while the attribute is missing.
  default?: unknown;
}

type VisibleBinding = Pick<
  PanelBinding,
  'id' | 'property' | 'value' | 'present' | 'meta'
>;

const isVisibleRule = (value: unknown): value is VisibleRule => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const rule = value as Record<string, unknown>;

  return (
    typeof rule.property === 'string' &&
    Array.isArray(rule.in) &&
    (rule.id === undefined || typeof rule.id === 'string')
  );
};

// Whether `binding` shows, by its `meta.visible`: `false` hides it, a rule
// shows it while the binding it names holds one of `in`. Anything else
// shows it, a malformed rule included, so a typo never hides a field for
// good. `bindings` is where the rule looks the other binding up, usually
// `useDndPanel().bindings`.
export const isBindingVisible = (
  binding: VisibleBinding,
  bindings: readonly VisibleBinding[],
): boolean => {
  const rule = binding.meta?.visible;

  if (rule === false) {
    return false;
  }

  if (!isVisibleRule(rule)) {
    return true;
  }

  const source = bindings.find(
    item =>
      item.id === (rule.id ?? binding.id) && item.property === rule.property,
  );
  const value =
    source && source.present !== false ? source.value : rule.default;

  return Array.isArray(value)
    ? value.some(entry => rule.in.includes(entry))
    : rule.in.includes(value);
};

// A `meta` key that holds text, or `undefined` for anything else.
const readText = (
  binding: Pick<PanelBinding, 'meta'>,
  key: 'description' | 'group',
): string | undefined => {
  const value = binding.meta?.[key];

  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
};

// `meta.description`: a line shown under the field's label.
export const readDescription = (binding: Pick<PanelBinding, 'meta'>) =>
  readText(binding, 'description');

// `meta.group`: fields of one element with the same name share a box.
export const readGroup = (binding: Pick<PanelBinding, 'meta'>) =>
  readText(binding, 'group');

// The built-in panel arranged by the `meta` keys the docs suggest:
// `visible`, `group` and `description`. Pass it as `Live.Dnd`'s
// `panelLayout`, or spread it and replace one function (#763).
export const metaPanelLayout: DndPanelLayout = {
  isVisible: isBindingVisible,
  groupOf: readGroup,
  describe: readDescription,
};
