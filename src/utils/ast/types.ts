export interface Attribute {
  name: string;
  value: string | null;
  isStringLiteral?: boolean;
}

export interface DataAttrNode {
  id?: string;
  tagName: string;
  attributes: Attribute[];
  dataAttributes: Attribute[];
  textContent: string;
  rawChildren?: string;
  // Exact structural child source, used to validate source-preserving edits.
  source?: string;
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  children?: DataAttrNode[];
  isFragment?: boolean;
  bindings?: BindingItem[];
}

export interface BindingOption {
  label: string;
  value: string;
}

// Data kinds only — what a value *is*, never how to draw it. How a field is
// rendered belongs to `BindingItem.widget`, which the library passes through
// without interpreting: choosing a control is the consumer's job, so the
// built-in panel only ever renders the default control for each kind.
export const BINDING_TYPES = [
  'array',
  'object',
  'string',
  'number',
  'boolean',
  'color',
  'jsx',
  'richtext',
  'date',
  'url',
] as const;

export type BindingType = (typeof BINDING_TYPES)[number];

// Presentation config for one field, as opposed to `BindingItem.type`'s data
// kind. Authored either as the bare control name (`widget: 'slider'`) or as
// this object; `parseBinding` normalizes the string form into `{ type }`, so
// consumers only ever see one shape.
//
// Value *constraints* deliberately stay on the item, not here: `min`/`max`/
// `pattern`/`required` are enforced by `validateBindingValue` whether or not
// a widget was declared, so a plain number input still range-checks. Putting
// them here too would make the range unexpressible without a widget, and
// give a slider a second, conflicting source for the same bounds.
export interface BindingWidget {
  // The control name. Open string, not an enum: the library implements no
  // controls of its own, so every value (e.g. `'slider'`) is a custom
  // panel's to switch on. The built-in panel ignores it.
  type: string;
  // Presentation hints general enough to be worth typing. Both were already
  // authorable before this object existed — they just landed in the untyped
  // `meta` bag, where nothing checked their names or value types.
  step?: number;
  unit?: string;
  // Any further widget-specific config the consumer declared. Open for the
  // same reason `type` is: a custom control's options are not this library's
  // to enumerate. See #234 on keeping unknown keys rather than stripping.
  [key: string]: unknown;
}

// The fields a binding declares about itself, shared by a top-level
// `BindingItem` and a nested render-map leaf so the two can't drift apart:
// a leaf is a field in the panel like any other and can say everything a
// flat field can. See #383.
export interface BindingFieldSpec {
  // Data kind — what the value *is*. Closed, since the library's own
  // validation/coercion (validateBindingValue, parseValue) has to be able
  // to switch on it exhaustively.
  type?: BindingType;
  // Presentation — how to *render* it, plus that control's own config. Always
  // the object form here even when authored as a bare string; see
  // BindingWidget.
  widget?: BindingWidget;
  options?: BindingOption[];
  render?: BindingRenderMap;
  min?: number;
  max?: number;
  pattern?: string;
  required?: boolean;
  // Consumer-defined keys that aren't one of the fields above — namespaced
  // here rather than spread onto the item itself so they can't collide with
  // a future first-class field. Per-widget config belongs in `widget`, not
  // here; this is for metadata about the field as a whole.
  // Undefined when nothing extra was authored, not an empty object. See
  // #234: `parseBinding` used to silently strip these.
  meta?: Record<string, unknown>;
}

// A render-map entry is a leaf when it declares `type` — even one that didn't
// survive sanitization, so an unrecognized leaf type degrades to untyped
// instead of dropping the entry (see sanitizeRenderMap in binding.ts and
// #234). `label`/`property` are optional here, unlike on BindingItem: both
// fall back to the entry's key.
export interface BindingRenderLeaf extends BindingFieldSpec {
  label?: string;
  property?: string;
}

export interface BindingRenderMap {
  [key: string]: BindingRenderLeaf | BindingRenderMap;
}

export interface BindingItem extends BindingFieldSpec {
  label: string;
  property: string;
}

export type NodeValueType =
  'boolean' | 'number' | 'string' | 'null' | 'array' | 'object' | 'unknown';

export type EditableNodeValueType = 'boolean' | 'number' | 'string' | 'null';

export interface ExtractedNodeValue {
  type: NodeValueType;
  value: string | number | boolean | null;
}
