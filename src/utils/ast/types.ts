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

export type BindingType =
  | 'array'
  | 'object'
  | 'string'
  | 'number'
  | 'boolean'
  | 'color'
  | 'jsx'
  | 'richtext';

export interface BindingRenderLeaf {
  type: BindingType;
  property?: string;
  render?: BindingRenderMap;
}

export interface BindingRenderMap {
  [key: string]: BindingRenderLeaf | BindingRenderMap;
}

export interface BindingItem {
  label: string;
  property: string;
  type?: BindingType;
  options?: BindingOption[];
  render?: BindingRenderMap;
}

export type NodeValueType =
  | 'boolean'
  | 'number'
  | 'string'
  | 'null'
  | 'array'
  | 'object'
  | 'unknown';

export type EditableNodeValueType = 'boolean' | 'number' | 'string' | 'null';

export interface ExtractedNodeValue {
  type: NodeValueType;
  value: string | number | boolean | null;
}
