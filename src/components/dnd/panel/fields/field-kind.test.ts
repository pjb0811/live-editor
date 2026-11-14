import { describe, expect, it } from 'vitest';

// The dnd entry, not `./field-kind`: these tests check what a custom panel
// imports.
import {
  type FieldKindBinding,
  getFieldKind,
  isStructuralFieldKind,
} from '../..';

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
    ['items', { property: 'data', value: '[...rows]' }],
    ['object', { property: 'data', type: 'object' as const, value: { a: 1 } }],
    ['object', { property: 'items', type: 'object' as const, value: { a: 1 } }],
    ['object', { property: 'data', value: { a: 1 } }],
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
    ['time', { type: 'time' as const }],
    ['datetime', { type: 'datetime' as const }],
    ['url', { type: 'url' as const }],
    ['email', { type: 'email' as const }],
    ['tel', { type: 'tel' as const }],
    ['number', { type: 'number' as const, value: 1 }],
    ['number', { value: 1 }],
    ['text', {}],
    ['function', { type: 'function' as const, value: '() => {}' }],
    ['image', { type: 'image' as const, value: '/a.png' }],
    [
      'select',
      {
        type: 'image' as const,
        value: '/a.png',
        options: [{ label: 'A', value: '/a.png' }],
      },
    ],
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

  // A select only while it can show the current value (#741).
  it('gives a function binding with options a select for a listed or empty value', () => {
    const options = [{ label: 'Open', value: 'actions.open' }];
    const fn = (value: string) => kindOf({ type: 'function', options, value });

    expect(fn('actions.open')).toBe('select');
    expect(fn('')).toBe('select');
    expect(fn('() => go()')).toBe('function');
    expect(
      kindOf({ type: 'function', options, value: '', canEditValue: false }),
    ).toBe('readonly');
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
