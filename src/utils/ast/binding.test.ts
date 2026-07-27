import { describe, expect, it, vi } from 'vitest';

import { BINDING_PROP, DATA_ATTR } from '../../enums';
import { findEditableChildren, getCurrentValue, parseBinding } from './binding';
import type { Attribute, DataAttrNode } from './types';

const makeNode = (overrides: Partial<DataAttrNode> = {}): DataAttrNode => ({
  tagName: 'div',
  attributes: [],
  dataAttributes: [],
  textContent: '',
  ...overrides,
});

const makeAttr = (name: string, value: string | null): Attribute => ({
  name,
  value,
});

describe('parseBinding', () => {
  it('returns an empty array for null input', () => {
    expect(parseBinding(null)).toEqual([]);
  });

  it('returns an empty array for empty string input', () => {
    expect(parseBinding('')).toEqual([]);
  });

  it('parses a valid array of label/property bindings', () => {
    const result = parseBinding("[{label: 'Title', property: 'innerText'}]");

    expect(result).toEqual([{ label: 'Title', property: 'innerText' }]);
  });

  it('defaults property to BINDING_PROP.INNER_HTML for richtext entries with no explicit property', () => {
    const result = parseBinding("[{label: 'Content', type: 'richtext'}]");

    expect(result).toEqual([
      {
        label: 'Content',
        property: BINDING_PROP.INNER_HTML,
        type: 'richtext',
      },
    ]);
  });

  it('does not set a type field for unknown/invalid type values', () => {
    const result = parseBinding(
      "[{label: 'X', property: 'y', type: 'not-a-real-type'}]",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('type');
  });

  it('extracts both type and property on nested render leaves', () => {
    const result = parseBinding(`
      [{
        label: 'Items',
        property: 'items',
        render: {
          icon: { type: 'string', property: 'innerText' }
        }
      }]
    `);

    expect(result).toHaveLength(1);
    expect(result[0]!.render).toEqual({
      icon: { type: 'string', property: 'innerText' },
    });
  });

  it('extracts min/max/pattern/required constraints when present', () => {
    const result = parseBinding(
      "[{label: 'Age', property: 'data-age', type: 'number', min: 0, max: 120, pattern: '^[0-9]+$', required: true}]",
    );

    expect(result).toEqual([
      {
        label: 'Age',
        property: 'data-age',
        type: 'number',
        min: 0,
        max: 120,
        pattern: '^[0-9]+$',
        required: true,
      },
    ]);
  });

  it('omits min/max/pattern/required fields entirely when not authored', () => {
    const result = parseBinding("[{label: 'Title', property: 'innerText'}]");

    expect(result[0]).not.toHaveProperty('min');
    expect(result[0]).not.toHaveProperty('max');
    expect(result[0]).not.toHaveProperty('pattern');
    expect(result[0]).not.toHaveProperty('required');
  });

  it('returns an empty array without throwing for malformed binding syntax', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => parseBinding("[{label: 'X',")).not.toThrow();
      expect(parseBinding("[{label: 'X',")).toEqual([]);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('getCurrentValue', () => {
  it('reads textContent for the innerText property', () => {
    const node = makeNode({ textContent: 'Hello world' });
    expect(getCurrentValue(node, BINDING_PROP.INNER_TEXT)).toBe('Hello world');
  });

  it('reads a JSON-stringified children array for the children property', () => {
    const child = makeNode({ tagName: 'span', textContent: 'child' });
    const node = makeNode({ children: [child] });

    expect(getCurrentValue(node, BINDING_PROP.CHILDREN)).toBe(
      JSON.stringify([child]),
    );
  });

  it('returns an empty JSON array string when children is undefined', () => {
    const node = makeNode();
    expect(getCurrentValue(node, BINDING_PROP.CHILDREN)).toBe('[]');
  });

  it('reads a custom attribute value for unrecognized properties', () => {
    const node = makeNode({
      attributes: [makeAttr('style', 'color: red')],
    });

    expect(getCurrentValue(node, 'style')).toBe('color: red');
  });

  it('returns an empty string when the custom attribute is missing', () => {
    const node = makeNode();
    expect(getCurrentValue(node, 'style')).toBe('');
  });

  it('falls back to rawChildren/textContent for innerHTML when no dangerouslySetInnerHTML attribute exists', () => {
    const node = makeNode({ rawChildren: '<b>raw</b>' });
    expect(getCurrentValue(node, BINDING_PROP.INNER_HTML)).toBe('<b>raw</b>');
  });

  it('reads the __html value out of a dangerouslySetInnerHTML attribute expression', () => {
    const node = makeNode({
      attributes: [
        makeAttr('dangerouslySetInnerHTML', "{ __html: 'hi there' }"),
      ],
    });

    expect(getCurrentValue(node, BINDING_PROP.INNER_HTML)).toBe('hi there');
  });
});

describe('findEditableChildren', () => {
  it('finds direct and grandchild nodes carrying a resolvable data-binding attribute', () => {
    const bindingValue = "[{label: 'Title', property: 'innerText'}]";

    const editableGrandchild = makeNode({
      tagName: 'span',
      dataAttributes: [makeAttr(DATA_ATTR.BINDING, bindingValue)],
    });

    const nonEditableChild = makeNode({
      tagName: 'div',
      children: [editableGrandchild],
    });

    const editableChild = makeNode({
      tagName: 'h1',
      dataAttributes: [makeAttr(DATA_ATTR.BINDING, bindingValue)],
    });

    const root = makeNode({
      tagName: 'section',
      children: [nonEditableChild, editableChild],
    });

    const result = findEditableChildren(root);

    expect(result).toHaveLength(2);
    expect(result).toContain(editableChild);
    expect(result).toContain(editableGrandchild);
    expect(result).not.toContain(nonEditableChild);
  });

  it('uses a precomputed bindings array when present instead of re-parsing', () => {
    const editableChild = makeNode({
      tagName: 'h1',
      dataAttributes: [makeAttr(DATA_ATTR.BINDING, 'ignored-if-bindings-set')],
      bindings: [{ label: 'Title', property: 'innerText' }],
    });

    const root = makeNode({ children: [editableChild] });

    expect(findEditableChildren(root)).toEqual([editableChild]);
  });

  it('returns an empty array when there are no children', () => {
    expect(findEditableChildren(makeNode())).toEqual([]);
  });

  it('ignores children whose data-binding attribute parses to no bindings', () => {
    const child = makeNode({
      dataAttributes: [makeAttr(DATA_ATTR.BINDING, '[]')],
    });
    const root = makeNode({ children: [child] });

    expect(findEditableChildren(root)).toEqual([]);
  });
});
