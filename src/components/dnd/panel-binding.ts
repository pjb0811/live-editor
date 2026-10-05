import { RESERVED_BINDING_PROPERTIES } from '~/constants';
import {
  getCurrentValue,
  getStructuredValue,
  readNodeBindings,
} from '~/utils/ast/binding';
import {
  type BindingItem,
  type BindingOption,
  type BindingRenderLeaf,
  type BindingRenderMap,
  type BindingType,
  type BindingWidget,
  type DataAttrNode,
} from '~/utils/ast/types';
import { canLosslesslyEvaluateSource } from '~/utils/ast/value';

// Commits one field by its element's `data-id`. Used by `DndPanel` and
// `Field` (#308).
export interface PanelNodeChange {
  (params: {
    id: string;
    label: string;
    property: string;
    value: unknown;
  }): void;
}

// Several `PanelNodeChange`s as one edit, applied in order, all or none: if
// one is refused, nothing is committed and the error names it (#425).
// Calling `PanelNodeChange` several times instead makes one change per call
// and keeps the earlier ones when a later one fails. An empty array does
// nothing.
export interface PanelNodesChange {
  (changes: Parameters<PanelNodeChange>[0][]): void;
}

// One editable binding of the selected section: what a custom panel needs
// to render its own control, with an `onChange` that commits the edit.
export interface PanelBinding {
  // The element's `data-id`, stable across edits.
  id: string;
  // Human-readable label from the binding definition.
  label: string;
  // The bound prop/attribute name (e.g. `children`, `src`, `color`).
  property: string;
  // The declared type. Switch on it to pick a control: an input for
  // `string` or `url`, a text area for `jsx` or `richtext`, a checkbox for
  // `boolean`, and so on. `undefined` means a plain string.
  type?: BindingType;
  // The control the binding asks for, such as `{ type: 'slider', step: 5 }`,
  // always in object form. Switch on `widget.type`, any string. The built-in
  // panel ignores it. Constraints are the fields below, not part of this.
  widget?: BindingWidget;
  // A fixed set of choices, for a select.
  options?: BindingOption[];
  // For `object` and `array` bindings: the types of the nested keys or
  // items, which the built-in panel uses for their fields.
  render?: BindingRenderMap;
  // Constraints, as `validateBindingValue` checks them. `min` and `max`
  // apply to the number a `type: 'number'` binding's `value` holds.
  min?: number;
  max?: number;
  pattern?: string;
  required?: boolean;
  // The binding's own keys, such as `group` or `tab`, kept apart so they
  // can't collide with a field added later. Absent when there are none
  // (#234).
  meta?: Record<string, unknown>;
  // The current value as its JS type: a number for `number`, a boolean for
  // `boolean`, an object or array for `object` and `array`, otherwise a
  // string (#238).
  value: unknown;
  // The source text behind `value`, for what a JS value can't hold: `jsx`
  // and `richtext`, or an expression to edit as text.
  rawValue: string;
  // `false` when editing the value would mean rebuilding it and losing an
  // expression, spread, hole or reference. The array and JSX editors apply
  // their own, narrower checks.
  canEditValue?: boolean;
  // `false` when the element doesn't have the attribute. Absent otherwise,
  // and always for content (`innerText`, `innerHTML`, `children`).
  // `onChange(undefined)` removes the attribute and `onChange(value)` adds it,
  // so a panel can draw an on/off control from this. `prop=""` counts as
  // present (#426).
  present?: boolean;
  // The element the binding belongs to: its tag name as written and its own
  // text, trimmed (`''` when it has none). The built-in panel heads each
  // element's fields with these, to tell apart bindings with the same label
  // (#514). Absent for an array item's property.
  element?: PanelBindingElement;
  // Commits a new value the same way the built-in panel does, errors
  // included. Pass the value as its JS type; it's written according to the
  // declared `type`.
  onChange: (value: unknown) => void;
}

export interface PanelBindingElement {
  tagName: string;
  text: string;
}

// A `PanelBinding` without `onChange`. Reading a node can be cached;
// `onChange` must come from the current render, so it's added separately
// (#336).
export type PanelBindingData = Omit<PanelBinding, 'onChange'>;

// One data-bound element and its panel bindings.
export interface PanelBindingSource {
  // `data-id` of the element every binding below belongs to.
  id: string;
  // `'element'` when the tag has no name.
  tagName: string;
  bindings: PanelBindingData[];
}

const readAttribute = (node: DataAttrNode, name: string) =>
  node.dataAttributes.find(attribute => attribute.name === name)?.value;

const canEditBindingValue = (node: DataAttrNode, binding: BindingItem) => {
  // The editor owns these attributes; `update()` refuses them too (#429).
  if (RESERVED_BINDING_PROPERTIES.includes(binding.property)) {
    return false;
  }

  if (
    binding.property === 'children' ||
    binding.property === 'innerText' ||
    binding.property === 'innerHTML' ||
    binding.property === 'items' ||
    binding.property === 'data' ||
    binding.type === 'array' ||
    binding.type === 'jsx' ||
    binding.type === 'richtext'
  ) {
    return true;
  }

  const attribute = node.attributes.find(
    candidate => candidate.name === binding.property,
  );

  // Not in the source yet: nothing to lose, and a value adds it (#426).
  if (!attribute) {
    return true;
  }

  return (
    attribute.isStringLiteral === true ||
    canLosslesslyEvaluateSource(attribute?.value ?? '')
  );
};

// Every field a binding declares. The return type makes leaving one out a
// type error, so a field added to `BindingItem` reaches every panel and
// nested editor at once (#340, #383).
export const toBindingFields = (
  binding: BindingItem,
): { [K in keyof Required<BindingItem>]: BindingItem[K] } => ({
  label: binding.label,
  property: binding.property,
  type: binding.type,
  widget: binding.widget,
  options: binding.options,
  render: binding.render,
  min: binding.min,
  max: binding.max,
  pattern: binding.pattern,
  required: binding.required,
  meta: binding.meta,
});

// The binding for a nested key of an `object` or `array` value. A
// render-map leaf brings its own fields; `label` and `property` default to
// the key. A nested map, or no entry, gives an untyped field that passes
// its sub-map down.
export const resolveRenderEntry = (
  render: BindingRenderMap | undefined,
  key: string,
): BindingItem => {
  const entry = render?.[key];

  if (entry && 'type' in entry) {
    const leaf = entry as BindingRenderLeaf;

    return {
      ...leaf,
      label: leaf.label ?? key,
      property: leaf.property ?? key,
    };
  }

  return { label: key, property: key, render: entry as BindingRenderMap };
};

// Properties that are the element's content rather than one of its
// attributes, so there's nothing to be absent.
const CONTENT_PROPERTIES = new Set(['innerText', 'innerHTML', 'children']);

const isAttributeAbsent = (node: DataAttrNode, binding: BindingItem) =>
  !CONTENT_PROPERTIES.has(binding.property) &&
  !node.attributes.some(candidate => candidate.name === binding.property);

const toPanelBindingData = (
  node: DataAttrNode,
  id: string,
  binding: BindingItem,
): PanelBindingData => ({
  ...toBindingFields(binding),
  id,
  value: getStructuredValue(node, binding.property, binding.type),
  rawValue: getCurrentValue(node, binding.property),
  ...(!canEditBindingValue(node, binding) && { canEditValue: false }),
  ...(isAttributeAbsent(node, binding) && { present: false }),
  element: {
    tagName: node.tagName || 'element',
    text: node.textContent.replace(/\s+/g, ' ').trim(),
  },
});

// An extracted element's panel bindings, without `onChange`. `null` when it
// isn't editable: no `data-id`, or no bindings. Uses the bindings `extract()`
// already resolved (#509, #513), so it's cheap enough for every element.
export const resolvePanelBindings = (
  node: DataAttrNode,
): PanelBindingSource | null => {
  const id = readAttribute(node, 'data-id');

  if (!id) {
    return null;
  }

  const parsed = readNodeBindings(node);

  if (!parsed.length) {
    return null;
  }

  return {
    id,
    tagName: node.tagName || 'element',
    bindings: parsed.map(binding => toPanelBindingData(node, id, binding)),
  };
};

// Adds `onChange` to bindings read by `resolvePanelBindings`. Call it during
// render, not inside a memo: `commit` belongs to the current document, and an
// old one would write older source over newer (#336).
export const withPanelCommit = (
  bindings: PanelBindingData[],
  commit: PanelNodeChange | undefined,
): PanelBinding[] =>
  bindings.map(binding => ({
    ...binding,
    onChange: (value: unknown) =>
      commit?.({
        id: binding.id,
        label: binding.label,
        property: binding.property,
        value,
      }),
  }));
