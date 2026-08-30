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

// `icon-picker`/`asset-picker` are kept here as deprecated aliases, not
// removed — see #236. They describe a *control*, not a data kind, and
// conflating that with the rest of this list (which does describe what a
// value actually is) left a consumer with nowhere to express their own
// widget choice. `parseBinding` normalizes an authored `type: 'icon-picker'`
// into `{ type: 'string', widget: 'icon-picker' }` rather than passing it
// through as-is, so existing authored content keeps working unchanged while
// `BindingItem.widget` becomes the real, open-ended home for this axis.
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
  'icon-picker',
  'asset-picker',
] as const;

export type BindingType = (typeof BINDING_TYPES)[number];

export interface BindingRenderLeaf {
  // Optional, matching the top-level BindingItem.type — an unrecognized
  // leaf type degrades to untyped instead of dropping the entry (see
  // sanitizeRenderMap in binding.ts and #234).
  type?: BindingType;
  property?: string;
  render?: BindingRenderMap;
}

export interface BindingRenderMap {
  [key: string]: BindingRenderLeaf | BindingRenderMap;
}

export interface BindingItem {
  label: string;
  property: string;
  // Data kind — what the value *is*. Closed, since the library's own
  // validation/coercion (validateBindingValue, parseValue) has to be able
  // to switch on it exhaustively.
  type?: BindingType;
  // Presentation — how to *render* it. Deliberately an open string, not a
  // closed enum: the library cannot enumerate controls it doesn't
  // implement, and a renderPanel consumer owns presentation once they use
  // it (see #234/#236). `'icon-picker'`/`'asset-picker'` are the built-in
  // panel's own two widgets; anything else (e.g. `'slider'`) is free for a
  // custom renderPanel to switch on.
  widget?: string;
  options?: BindingOption[];
  render?: BindingRenderMap;
  min?: number;
  max?: number;
  pattern?: string;
  required?: boolean;
  // Consumer-defined keys that aren't one of the fields above (`step`,
  // `unit`, a widget hint, ...) — namespaced here rather than spread onto
  // the item itself so they can't collide with a future first-class field.
  // Undefined when nothing extra was authored, not an empty object. See
  // #234: `parseBinding` used to silently strip these.
  meta?: Record<string, unknown>;
}

export type NodeValueType =
  'boolean' | 'number' | 'string' | 'null' | 'array' | 'object' | 'unknown';

export type EditableNodeValueType = 'boolean' | 'number' | 'string' | 'null';

export interface ExtractedNodeValue {
  type: NodeValueType;
  value: string | number | boolean | null;
}
