import { describe, expect, it } from 'vitest';

import { type FieldKindBinding, getFieldKind, isStructuralFieldKind } from '.';

const kindOf = (override: Partial<FieldKindBinding>) =>
  getFieldKind({ property: 'value', value: 'text', ...override });

const childNode = {
  tagName: 'p',
  dataAttributes: [],
  attributes: [],
  children: [],
};

// Imported through the dnd entry, as a custom panel would.
describe('getFieldKind from the dnd entry', () => {
  it.each([
    ['readonly', { canEditValue: false, type: 'number' as const, value: 1 }],
    ['items', { property: 'items', value: [] }],
    ['items', { property: 'data', value: [] }],
    ['items', { type: 'array' as const, value: [] }],
    ['richtext', { type: 'richtext' as const }],
    ['html', { property: 'innerHTML' }],
    ['jsx', { type: 'jsx' as const }],
    ['children', { property: 'children', value: [childNode] }],
    ['object', { value: { a: 1 } }],
    ['boolean', { type: 'boolean' as const, value: 'true' }],
    ['boolean', { value: false }],
    ['select', { options: [{ label: 'A', value: 'a' }] }],
    ['color', { type: 'color' as const }],
    ['color', { property: 'backgroundColor' }],
    ['date', { type: 'date' as const }],
    ['url', { type: 'url' as const }],
    ['number', { type: 'number' as const, value: 1 }],
    ['number', { value: 1 }],
    ['text', {}],
  ])('%s for %o', (kind, override) => {
    expect(kindOf(override)).toBe(kind);
  });

  // The first matching rule wins, the same order `Field` checks them in.
  it('applies the rules in the built-in order', () => {
    expect(kindOf({ canEditValue: false, property: 'items', value: [] })).toBe(
      'readonly',
    );
    expect(kindOf({ property: 'items', type: 'richtext', value: [] })).toBe(
      'items',
    );
    expect(kindOf({ property: 'innerHTML', type: 'jsx' })).toBe('html');
    expect(kindOf({ type: 'richtext', property: 'innerHTML' })).toBe(
      'richtext',
    );
    expect(
      kindOf({ options: [{ label: 'A', value: 'a' }], type: 'color' }),
    ).toBe('select');
  });

  // A `children` binding whose value isn't extracted nodes (a plain text
  // child) gets a text control, not the Children editor.
  it('treats children as structural only when its value is a node array', () => {
    expect(kindOf({ property: 'children', value: [childNode] })).toBe(
      'children',
    );
    expect(kindOf({ property: 'children', value: 'Hello' })).toBe('text');
  });

  it('reports items and children as the structural kinds', () => {
    expect(isStructuralFieldKind('items')).toBe(true);
    expect(isStructuralFieldKind('children')).toBe(true);
    expect(isStructuralFieldKind('object')).toBe(false);
    expect(isStructuralFieldKind('text')).toBe(false);
  });
});
