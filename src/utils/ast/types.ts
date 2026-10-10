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

// The kinds of data a binding can hold: what a value is, not how to draw
// it. How to draw it is `widget`, which the library passes through without
// reading; the built-in panel renders the default control for each kind.
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

// How to draw one field, as opposed to `type`, which is what its data is.
// Written as a control name (`widget: 'slider'`) or as this object; parsing
// turns the string into `{ type }`, so consumers see one shape.
//
// Constraints (`min`, `max`, `pattern`, `required`) stay on the binding, not
// here, so `validateBindingValue` checks them with or without a widget.
export interface BindingWidget {
  // The control name, any string (such as `'slider'`). A custom panel
  // switches on it; the built-in panel ignores it.
  type: string;
  // Common presentation hints, typed.
  step?: number;
  unit?: string;
  // Any other config for the control, kept as written (#234).
  [key: string]: unknown;
}

// The fields a binding declares about itself. Shared by `BindingItem` and
// render-map leaves, so a nested field can say everything a top-level one
// can (#383).
export interface BindingFieldSpec {
  // What the value is. A closed set, because validation and parsing switch
  // on it.
  type?: BindingType;
  // How to draw it, always in object form. See `BindingWidget`.
  widget?: BindingWidget;
  options?: BindingOption[];
  render?: BindingRenderMap;
  min?: number;
  max?: number;
  pattern?: string;
  required?: boolean;
  // The app's own keys, anything not listed above, such as `group` or `tab`.
  // Kept apart so they can't collide with a field added later. Config for
  // the control goes in `widget` instead. `undefined` when there are none
  // (#234).
  meta?: Record<string, unknown>;
}

// A render-map entry is a leaf when it declares `type`, even an unknown
// one, which then shows as an untyped field (#234). `label` and `property`
// default to the entry's key.
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

// A component's tag name as written in the source: a member path
// (`ui.Button`) or an identifier that doesn't start with a lowercase letter
// (`Button`). Lowercase names are HTML elements.
export type BindingComponentName = `${string}.${string}` | Capitalize<string>;

// One entry of `bindings` or `bindingKeys`, as written: a `BindingItem` plus
// any key of the app's own (`group`, `tab`, `description`, ...), which
// arrives in `binding.meta` just as it does from an inline `data-binding`.
// `meta` itself isn't one of them: it's where those keys end up, so writing
// it here would nest it under `meta.meta`.
export interface BindingSchema extends Omit<BindingItem, 'meta'> {
  [key: string]: unknown;
}

// Bindings for every element of a component, keyed by its tag name as
// written, so markup doesn't have to repeat the same `data-binding` on each
// one (#509). Components only: an entry for an HTML element such as `p` or
// `h2` would make every one of them in every section editable, so those keys
// are rejected by the type and ignored at runtime. An element's own
// `data-binding`, even an empty one, takes precedence over its component's
// entry. Matched elements still need a `data-id` to be edited.
export type BindingRegistry = Partial<
  Record<BindingComponentName, BindingSchema[]>
>;

// Bindings an element asks for by name, with `data-binding-key="hero-title"`
// in its markup, on an HTML element or a component alike (#513). Plain data,
// so a host can load it from JSON or a CMS.
export type BindingKeyMap = Record<string, BindingSchema[]>;

// Where bindings come from besides an element's own `data-binding`, in
// order of precedence: the key its `data-binding-key` names in
// `bindingKeys`, then its component's entry in `bindings`.
export interface BindingOptions {
  bindings?: BindingRegistry;
  bindingKeys?: BindingKeyMap;
}

export type NodeValueType =
  'boolean' | 'number' | 'string' | 'null' | 'array' | 'object' | 'unknown';

export interface ExtractedNodeValue {
  type: NodeValueType;
  value: string | number | boolean | null;
}
