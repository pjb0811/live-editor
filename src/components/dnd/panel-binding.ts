import {
  type BindingItem,
  type BindingOption,
  type BindingRenderLeaf,
  type BindingRenderMap,
  type BindingType,
  type BindingWidget,
  type DataAttrNode,
  canLosslesslyEvaluateSource,
  getCurrentValue,
  getStructuredValue,
  parseBinding,
} from '~/utils/ast';

// The node-level commit callback's shape, named because it's part of the
// public surface in two places (`DndPanel`, `Field`) and was previously
// spelled out inline in each — see #308.
export interface PanelNodeChange {
  (params: {
    id: string;
    label: string;
    property: string;
    value: unknown;
  }): void;
}

// One editable data-binding, flattened out of the selected section for a
// custom panel. Exposes just what a consumer needs to render its own
// control — the declared `type`, the current `value`, and an `onChange`
// that commits through Dnd's AST-update pipeline — so it never has to touch
// DataAttrNode/parseBinding/getCurrentValue itself.
export interface PanelBinding {
  // `data-id` of the owning element — stable across edits.
  id: string;
  // Human-readable label from the binding definition.
  label: string;
  // The bound prop/attribute name (e.g. `children`, `src`, `color`).
  property: string;
  // The declared data-binding type — switch on this to pick a control
  // (`string`/`url` -> <input>, `jsx`/`richtext` -> <textarea>, `boolean`
  // -> checkbox, ...). `undefined` means a plain string binding.
  type?: BindingType;
  // Presentation, as opposed to `type`'s data kind — switch on `widget.type`,
  // an open string rather than a closed enum, since a custom panel can
  // declare any control it wants (e.g. `'slider'`) along with that control's
  // own config (`step`, `unit`, ...). Always the object form even when
  // authored as a bare string. Passed through untouched: the built-in panel
  // ignores it and renders the `type`-appropriate default control.
  //
  // Value constraints are *not* in here — `min`/`max`/`pattern`/`required`
  // below apply with or without a widget.
  widget?: BindingWidget;
  // Present when the binding defines a fixed option set (render a <select>).
  options?: BindingOption[];
  // Present for `object`/`array` bindings whose nested keys/items declare
  // their own types — the same map the built-in panel uses to type each
  // nested field instead of falling back to a plain string input.
  render?: BindingRenderMap;
  // Constraints declared on the binding. `min`/`max` compare against the
  // real number `value` delivers for `type: 'number'` bindings (see
  // `validateBindingValue`).
  min?: number;
  max?: number;
  pattern?: string;
  required?: boolean;
  // Consumer-defined keys carried straight through from the authored
  // data-binding — namespaced instead of spread onto PanelBinding so they
  // can't collide with a future first-class field. Absent when nothing
  // extra was authored. See #234.
  meta?: Record<string, unknown>;
  // Current value as its real JS type — a number for `type: 'number'`, a
  // boolean for `type: 'boolean'`, an object/array for `object`/`array`,
  // a string otherwise. Switch on this without re-parsing. See #238.
  value: unknown;
  // The exact source text behind `value`, for cases that can't round-trip
  // through a JS value — `jsx`/`richtext` bindings, or an attribute whose
  // source is an expression you want to edit as text.
  rawValue: string;
  // False when the built-in control would have to reconstruct a partial
  // literal and could discard an expression, spread, hole or reference.
  // Raw array/JSX editors retain their own narrower source-safe contracts.
  canEditValue?: boolean;
  // Commit a new value through the same AST-update pipeline the built-in
  // panel uses (including the error Toast on a bad edit). Pass the value as
  // its real type; it's serialized once, at the AST boundary, where the
  // declared `type` is known — so no string quoting/guessing on your side.
  onChange: (value: unknown) => void;
}

// A `PanelBinding` before a commit callback is attached. The split is the
// point of this module: reading a node is pure and cacheable, while
// `onChange` belongs to the render that made it. Binding the two together
// too early is what caused #336 — a memo keyed on the parsed section handed
// back callbacks still closed over a previous document.
export type PanelBindingData = Omit<PanelBinding, 'onChange'>;

// One data-bound element resolved into panel currency.
export interface PanelBindingSource {
  // `data-id` of the element every binding below belongs to.
  id: string;
  // Falls back to `'element'` so a caller rendering a heading never has to
  // repeat that default.
  tagName: string;
  bindings: PanelBindingData[];
}

const readAttribute = (node: DataAttrNode, name: string) =>
  node.dataAttributes.find(attribute => attribute.name === name)?.value;

const canEditBindingValue = (node: DataAttrNode, binding: BindingItem) => {
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

  return (
    attribute?.isStringLiteral === true ||
    canLosslesslyEvaluateSource(attribute?.value ?? '')
  );
};

// Every field a binding declares, listed exactly once. The mapped return type
// makes leaving one out a type error, so a field added to `BindingItem`
// reaches the built-in panel, a custom panel, nested item editors and
// render-map leaves together instead of whichever path the author happened
// to edit (#340, #383).
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

// The binding a nested key of an `object`/`array` value would have if it were
// declared at the top level. A render-map leaf carries its own field spec;
// `label` and `property` fall back to the key, which is what the property is
// actually called. A nested map (or nothing) yields an untyped field that
// still hands its sub-map down.
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
});

// Read one extracted element's `data-id`/`data-binding` into panel bindings.
// Returns `null` for anything not editable — a node missing either
// attribute, or one whose `data-binding` parses to nothing — so callers keep
// a single "skip this node" branch instead of re-deriving the rule.
//
// Reuses `node.bindings` when `extract()` already parsed the attribute and
// only falls back to `parseBinding` otherwise, which is what keeps this
// cheap enough to run on every node of a section.
export const resolvePanelBindings = (
  node: DataAttrNode,
): PanelBindingSource | null => {
  const id = readAttribute(node, 'data-id');
  const bindingAttr = readAttribute(node, 'data-binding');

  if (!id || !bindingAttr) {
    return null;
  }

  const parsed = node.bindings ?? parseBinding(bindingAttr);

  if (!parsed.length) {
    return null;
  }

  return {
    id,
    tagName: node.tagName || 'element',
    bindings: parsed.map(binding => toPanelBindingData(node, id, binding)),
  };
};

// Attach the node-level commit to already-read bindings. Call this during
// render, not inside a memo keyed on the parsed source: `commit` closes over
// the current document, and reusing a stale one writes an older source back
// over a newer one (#336).
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
