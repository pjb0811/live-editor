import * as t from '@babel/types';
import { describe, expect, it } from 'vitest';

import { BINDING_PROP } from '../../constants';
import {
  appendArrayItem,
  duplicateArrayItems,
  moveArrayItem,
  moveArrayItems,
  parseItems,
  removeArrayItems,
  updateArrayItemProperty,
  updateArrayItemValue,
} from './items';
import type { BindingRenderMap } from './types';
import { parseArrayExpression } from './value';

const OBJECTS = `[{ id: 1, title: 'a' }, { id: 2, title: 'b' }]`;
const PRIMITIVES = `['a', 'b', 'c']`;
const WITH_JSX = `[{ id: 1, icon: <Icon size={2} />, title: 'a' }, { id: 2, icon: <Other />, title: 'b' }]`;

// Deterministic stand-in for nanoid, so cloned `key` values are assertable.
const ids = () => {
  let count = 0;

  return () => `ID${count++}`;
};

describe('parseItems', () => {
  it('classifies each element and indexes by element position', () => {
    expect(
      parseItems(`[1, { a: 2 }, 'x']`)?.map(item => [item.index, item.kind]),
    ).toEqual([
      [0, 'primitive'],
      [1, 'object'],
      [2, 'primitive'],
    ]);
  });

  it('returns null when the value is not an array expression', () => {
    expect(parseItems('not an array')).toBeNull();
    expect(parseItems('{ a: 1 }')).toBeNull();
  });
});

describe('updateArrayItemProperty', () => {
  it('writes a string property', () => {
    expect(updateArrayItemProperty(OBJECTS, 0, 'title', 'zz')).toContain(
      'title: "zz"',
    );
  });

  it('coerces the field text before building a scalar literal', () => {
    const code = `[{ flag: true, count: 5 }]`;

    expect(updateArrayItemProperty(code, 0, 'flag', 'false')).toContain(
      'flag: false',
    );
    expect(updateArrayItemProperty(code, 0, 'count', '9')).toContain(
      'count: 9',
    );
  });

  // An object/array value arrives as source text from the nested editor.
  // Coercing it first would evaluate it and `String()` it back to `1,2`.
  it('parses an object/array value straight from its source text', () => {
    const code = `[{ style: { color: 'red' }, tags: [1, 2] }]`;

    expect(updateArrayItemProperty(code, 0, 'tags', '[3, 4]')).toContain(
      'tags: [3, 4]',
    );
    expect(
      updateArrayItemProperty(code, 0, 'style', "{ color: 'blue' }"),
    ).toContain("color: 'blue'");
  });

  const jsxRender: BindingRenderMap = { icon: { type: 'jsx' } };

  it('parses a jsx value into a node, preserving its own syntax', () => {
    expect(
      updateArrayItemProperty(
        WITH_JSX,
        0,
        'icon',
        '<New a={1 > 0} />',
        jsxRender,
      ),
    ).toContain('icon: <New a={1 > 0} />');
  });

  // The items panel's fallback editor (see #298) edits a JSX-valued
  // property's raw source with no `render` declaration for it — the current
  // AST value being JSX has to be enough to route the commit through the
  // jsx parse path instead of the scalar-string one.
  it('parses a jsx value with no render declaration, from its current JSX value', () => {
    expect(
      updateArrayItemProperty(WITH_JSX, 0, 'icon', '<New a={1 > 0} />'),
    ).toContain('icon: <New a={1 > 0} />');
  });

  it('treats a non-markup jsx value as a plain string', () => {
    expect(
      updateArrayItemProperty(WITH_JSX, 0, 'icon', 'plain text', jsxRender),
    ).toContain('icon: "plain text"');
  });

  // Untouched JSX used to be swapped for `__JSX_<id>__` identifiers and
  // substituted back after generation. Babel prints it correctly as-is.
  it('leaves other items JSX properties intact', () => {
    const result = updateArrayItemProperty(WITH_JSX, 0, 'title', 'new');

    expect(result).toContain('icon: <Icon size={2} />');
    expect(result).toContain('icon: <Other />');
    expect(result).not.toContain('__JSX_');
  });

  // The old post-generation `String.replace` treated these as substitution
  // patterns; writing the node directly cannot misread them.
  it('keeps $& and $$ in an innerHTML value verbatim', () => {
    const render: BindingRenderMap = {
      title: { type: 'string', property: BINDING_PROP.INNER_HTML },
    };

    expect(
      updateArrayItemProperty(OBJECTS, 0, 'title', '<p>$& $$</p>', render),
    ).toContain('title: `<p>$& $$</p>`');
  });

  it('returns null for an unknown index, a non-object item or a missing property', () => {
    expect(updateArrayItemProperty(OBJECTS, 9, 'title', 'x')).toBeNull();
    expect(updateArrayItemProperty(PRIMITIVES, 0, 'title', 'x')).toBeNull();
    expect(updateArrayItemProperty(OBJECTS, 0, 'nope', 'x')).toBeNull();
  });

  it('returns null when an object value cannot be parsed', () => {
    const code = `[{ tags: [1, 2] }]`;

    expect(updateArrayItemProperty(code, 0, 'tags', '[1,')).toBeNull();
  });

  // Only the nested Items editor commits source text; the object editor and
  // the fallback TextArea commit a real JS value. `String()`-ing those would
  // produce `3,4` (a sequence expression) and `[object Object]`.
  it('rebuilds an object/array property given a real JS value', () => {
    expect(
      updateArrayItemProperty(`[{ tags: [1, 2] }]`, 0, 'tags', [3, 4]),
    ).toContain('tags: [3, 4]');
    expect(
      updateArrayItemProperty(`[{ s: { c: 'r' } }]`, 0, 's', { c: 'b' }),
    ).toContain('"c": "b"');
  });

  // A JS value has already been through `evaluateLiteral`, which yields
  // `undefined` for a non-literal and skips spreads. Rebuilding from it
  // would write `{ c: theme.red }` back as `{}` — and the panel's untyped
  // field commits on blur, so no actual edit is needed to trigger it.
  it.each([
    ['an identifier', `[{ tags: [1, foo] }]`, 'tags', [1, undefined]],
    ['a member expression', `[{ s: { c: theme.red } }]`, 's', {}],
    ['a call', `[{ s: { c: fn() } }]`, 's', {}],
    ['a spread element', `[{ tags: [...other] }]`, 'tags', [undefined]],
    ['a spread property', `[{ s: { ...rest, a: 1 } }]`, 's', { a: 1 }],
  ])(
    'refuses to rebuild a property holding %s',
    (_name, code, key, committed) => {
      expect(updateArrayItemProperty(code, 0, key, committed)).toBeNull();
    },
  );

  // The guard mirrors what `evaluateLiteral`/`valueToExpression` actually
  // round-trip, so shapes that are not literal *nodes* but still survive
  // intact — a negative number is a UnaryExpression — are not refused.
  it.each([
    [
      'a negative number',
      `[{ style: { marginTop: -8 } }]`,
      'style',
      { marginTop: -4 },
      'marginTop": -4',
    ],
    [
      'a nested negative number',
      `[{ tags: [{ x: -1 }] }]`,
      'tags',
      [{ x: -2 }],
      'x": -2',
    ],
    ['a numeric key', `[{ s: { 1: 'a' } }]`, 's', { 1: 'b' }, '"1": "b"'],
    [
      'an expression-free template literal',
      '[{ s: { c: `r` } }]',
      's',
      { c: 'b' },
      '"c": "b"',
    ],
  ])(
    'rebuilds a property holding %s',
    (_name, code, key, committed, expected) => {
      expect(updateArrayItemProperty(code, 0, key, committed)).toContain(
        expected,
      );
    },
  );

  // `@babel/types` rejects a template raw holding an unescaped backtick or
  // `${`, which used to throw straight out of the edit handler.
  it.each([
    ['a backtick', '<p>`a`</p>'],
    ['an interpolation', 'Total: ${amount}'],
    ['a backslash', 'back\\slash'],
    ['a trailing backslash', 'tail\\'],
    ['CRLF', 'first\r\nsecond'],
    ['a lone carriage return', 'first\rsecond'],
  ])('keeps an innerHTML value containing %s intact', (_name, value) => {
    const render: BindingRenderMap = {
      body: { type: 'string', property: BINDING_PROP.INNER_HTML },
    };

    const code = updateArrayItemProperty(
      `[{ body: 'x' }]`,
      0,
      'body',
      value,
      render,
    );
    const element = parseArrayExpression(code ?? '')?.elements[0];
    const property = t.isObjectExpression(element)
      ? (element.properties[0] as t.ObjectProperty)
      : undefined;

    expect(
      t.isTemplateLiteral(property?.value)
        ? property.value.quasis[0]?.value.cooked
        : undefined,
    ).toBe(value);
  });
});

describe('updateArrayItemValue', () => {
  it('replaces a primitive, keeping its type', () => {
    expect(updateArrayItemValue(PRIMITIVES, 1, 'z')).toBe(`['a', "z", 'c']`);
    expect(updateArrayItemValue(`[1, 2]`, 0, '42')).toBe('[42, 2]');
  });

  it('returns null for an index that does not exist', () => {
    expect(updateArrayItemValue(PRIMITIVES, 9, 'z')).toBeNull();
  });
});

describe('moveArrayItem', () => {
  it('moves an item to a new position', () => {
    expect(moveArrayItem(PRIMITIVES, 0, 2)).toBe(`['b', 'c', 'a']`);
  });

  // Matches the splice pair's own semantics, so a disabled move button that
  // fires anyway is a no-op rather than a reported failure.
  it('is a no-op when the destination is past the end', () => {
    expect(moveArrayItem(`['only']`, 0, 1)).toBe(`['only']`);
  });

  it('returns null when the source index does not exist', () => {
    expect(moveArrayItem(PRIMITIVES, 9, 0)).toBeNull();
  });
});

describe('moveArrayItems', () => {
  it('shifts the selection as a block and reports its new indices', () => {
    const result = moveArrayItems(
      `['a', 'b', 'c', 'd']`,
      new Set([2, 3]),
      'up',
    );

    expect(result?.code).toBe(`['a', 'c', 'd', 'b']`);
    expect([...(result?.indices ?? [])].sort()).toEqual([1, 2]);
  });

  it('returns null when the value is not an array', () => {
    expect(moveArrayItems('nope', new Set([0]), 'up')).toBeNull();
  });
});

describe('removeArrayItems', () => {
  it('removes the selected items', () => {
    expect(removeArrayItems(`['a', 'b', 'c']`, new Set([0, 2]))).toBe(`['b']`);
  });

  // Every "add" clones an existing item, so an empty array is a dead end.
  it('refuses to remove the last remaining item', () => {
    expect(removeArrayItems(`['a']`, new Set([0]))).toBeNull();
    expect(removeArrayItems(`['a', 'b']`, new Set([0, 1]))).toBeNull();
  });

  // `appendArrayItem` clones an item of the requested kind, so the guard has
  // to count that kind — otherwise the object panel can delete its last
  // object while a primitive keeps the array non-empty, and "Add Item" then
  // has no object left to copy.
  it('refuses to remove the last item of the given kind', () => {
    expect(
      removeArrayItems(`['keep', { id: 1 }]`, new Set([1]), 'object'),
    ).toBeNull();
    expect(
      removeArrayItems(`['keep', { id: 1 }]`, new Set([0]), 'primitive'),
    ).toBeNull();
    expect(
      removeArrayItems(`[{ a: 1 }, { b: 2 }]`, new Set([0]), 'object'),
    ).toBe(`[{\n  b: 2\n}]`);
  });
});

describe('duplicateArrayItems', () => {
  // Copies are cloned rather than rebuilt, so they keep their source text.
  it('appends copies in index order', () => {
    expect(duplicateArrayItems(`['a', 'b']`, new Set([1, 0]), ids())).toBe(
      `['a', 'b', 'a', 'b']`,
    );
  });

  it('gives a cloned object a fresh key so the copy stays distinguishable', () => {
    const result = duplicateArrayItems(
      `[{ key: 'k1', label: 'x' }]`,
      new Set([0]),
      ids(),
    );

    expect(result).toContain("key: 'k1'");
    expect(result).toContain('key: "k1-ID0"');
  });

  it('returns null when nothing is selected', () => {
    expect(duplicateArrayItems(OBJECTS, new Set(), ids())).toBeNull();
  });
});

describe('appendArrayItem', () => {
  it('appends a copy of the first object item', () => {
    expect(appendArrayItem(`[{ key: 'k1' }]`, 'object', ids())).toBe(
      `[{\n  key: 'k1'\n}, {\n  key: "k1-ID0"\n}]`,
    );
  });

  it('appends a copy of the first primitive item', () => {
    expect(appendArrayItem(PRIMITIVES, 'primitive', ids())).toBe(
      `['a', 'b', 'c', "a"]`,
    );
  });

  // A mixed array only ever shows one kind in the panel, so the template
  // has to be picked by kind rather than by position.
  it('picks the template by kind in a mixed array', () => {
    expect(appendArrayItem(`['a', { id: 1 }]`, 'object', ids())).toContain(
      'id: 1\n}, {\n  id: 1',
    );
  });

  it('returns null when there is no item of that kind to copy', () => {
    expect(appendArrayItem(PRIMITIVES, 'object', ids())).toBeNull();
    expect(appendArrayItem(OBJECTS, 'primitive', ids())).toBeNull();
  });
});

// The panel renders one kind at a time, but the array can hold both. Every
// function indexes by element position, so the items that aren't on screen
// keep their place instead of being dropped on the next edit.
describe('mixed arrays', () => {
  const MIXED = `['keep', { id: 1 }, 42]`;

  it('preserves primitives when editing an object item', () => {
    const result = updateArrayItemProperty(MIXED, 1, 'id', '2');

    expect(result).toContain("'keep'");
    expect(result).toContain('42');
    expect(result).toContain('id: 2');
  });

  it('preserves primitives when removing an object item', () => {
    expect(
      removeArrayItems(
        `['keep', { id: 1 }, { id: 2 }, 42]`,
        new Set([1]),
        'object',
      ),
    ).toBe(`['keep', {\n  id: 2\n}, 42]`);
  });
});
