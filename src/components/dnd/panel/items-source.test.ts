import { describe, expect, it } from 'vitest';

import type { DataAttrNode } from '~/utils/ast/types';

import { parseSource } from './items-source';

const dataIdOf = (node: DataAttrNode) =>
  node.dataAttributes.find(attribute => attribute.name === 'data-id')?.value;

describe('parseSource', () => {
  it('splits object and primitive items, keeping their array positions', () => {
    const value = `[{ key: 'a' }, 'one', { key: 'b' }, 2]`;
    const { objectItems, primitiveItems, parseError } = parseSource(value);

    expect(parseError).toBe(false);
    expect(
      objectItems.map(({ index, elementIndex, source }) => ({
        index,
        elementIndex,
        source,
      })),
    ).toEqual([
      { index: 0, elementIndex: 0, source: "{ key: 'a' }" },
      { index: 1, elementIndex: 2, source: "{ key: 'b' }" },
    ]);
    expect(
      primitiveItems.map(({ index, elementIndex, value, type }) => ({
        index,
        elementIndex,
        value,
        type,
      })),
    ).toEqual([
      { index: 0, elementIndex: 1, value: 'one', type: 'string' },
      { index: 1, elementIndex: 3, value: 2, type: 'number' },
    ]);
  });

  it('gives every item a fresh id', () => {
    const { primitiveItems } = parseSource(`['one', 'two']`);

    expect(primitiveItems[0]!.id).not.toBe(primitiveItems[1]!.id);
  });

  it('reports a source that is not an array expression', () => {
    expect(parseSource(`{ key: 'a' }`)).toEqual({
      objectItems: [],
      primitiveItems: [],
      parseError: true,
    });
  });

  it('keeps the source of array and object property values', () => {
    const value = `[{ tags: ['x', 'y'], meta: { size: 2 } }]`;
    const { editableProperties } = parseSource(value).objectItems[0]!;

    expect(editableProperties.tags!.value).toBe(`['x', 'y']`);
    expect(editableProperties.meta!.value).toBe('{ size: 2 }');
  });

  // A container that declares `children` owns the elements below it, so
  // listing them too would offer the same edit twice.
  it('takes only the container from JSX that declares children', () => {
    const value = `[{
      children: (
        <div data-id="wrap" data-binding={[{ label: 'Cards', property: 'children' }]}>
          <p data-id="t1" data-binding={[{ label: 'Title', property: 'innerText' }]}>Open</p>
        </div>
      ),
    }]`;
    const { jsxBindings, jsxFallbacks } = parseSource(value).objectItems[0]!;

    expect(jsxBindings.children!.map(dataIdOf)).toEqual(['wrap']);
    expect(jsxFallbacks).toEqual({});
  });

  it('lists each bound element of JSX without a children container', () => {
    const value = `[{
      label: (
        <div>
          <p data-id="t1" data-binding={[{ label: 'Title', property: 'innerText' }]}>Open</p>
          <p data-id="d1" data-binding={[{ label: 'Body', property: 'innerText' }]}>Source</p>
        </div>
      ),
    }]`;
    const { jsxBindings } = parseSource(value).objectItems[0]!;

    expect(jsxBindings.label!.map(dataIdOf)).toEqual(['t1', 'd1']);
  });

  it('keeps the source of JSX with no bindings as a fallback', () => {
    const { jsxBindings, jsxFallbacks } = parseSource(
      `[{ children: <div>A content</div> }]`,
    ).objectItems[0]!;

    expect(jsxBindings).toEqual({});
    expect(jsxFallbacks).toEqual({ children: '<div>A content</div>' });
  });
});
