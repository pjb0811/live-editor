import { describe, expect, it } from 'vitest';

import { findEditableChildren, getRegistryBindings } from './binding';
import { getChildrenSignatures } from './children';
import { extract } from './extract';
import type { BindingRegistry } from './types';
import { update, updateAll } from './update';

// A binding registry gives every element of a tag the same bindings, so the
// markup only carries a `data-id` (#509).
const registry: BindingRegistry = {
  'ui.Button': [
    { label: 'Text', property: 'innerText' },
    { label: 'Size', property: 'size', widget: { type: 'select' } },
  ],
  h2: [{ label: 'Heading', property: 'innerText', required: true }],
  ul: [{ label: 'Items', property: 'children' }],
  li: [{ label: 'Item', property: 'innerText' }],
};

const options = { bindings: registry };

describe('getRegistryBindings', () => {
  it('returns the normalized entry for a tag, and nothing for others', () => {
    expect(getRegistryBindings(registry, 'ui.Button')).toEqual([
      { label: 'Text', property: 'innerText' },
      { label: 'Size', property: 'size', widget: { type: 'select' } },
    ]);
    expect(getRegistryBindings(registry, 'p')).toBeUndefined();
    expect(getRegistryBindings(registry, 'constructor')).toBeUndefined();
    expect(getRegistryBindings(undefined, 'h2')).toBeUndefined();
  });

  it('drops entries an inline data-binding would drop too', () => {
    const loose = { p: [{ property: 'innerText' }] } as never;

    expect(getRegistryBindings(loose, 'p')).toEqual([]);
  });
});

describe('extract with a binding registry', () => {
  it("gives an element without data-binding its tag's bindings", () => {
    const [node] = extract(
      `<ui.Button data-id="b" size="small">Go</ui.Button>`,
      options,
    );

    expect(node!.bindings).toEqual(getRegistryBindings(registry, 'ui.Button'));
  });

  it("prefers the element's own data-binding, an empty one included", () => {
    const [own, optedOut] = extract(
      `<h2 data-id="a" data-binding={[{ label: 'Title', property: 'title' }]} title="t">x</h2>
       <h2 data-id="b" data-binding={[]}>y</h2>`,
      options,
    );

    expect(own!.bindings).toEqual([{ label: 'Title', property: 'title' }]);
    expect(optedOut!.bindings).toEqual([]);
  });

  it('reads children the way the registered binding says', () => {
    const [list] = extract(
      `<ul data-id="l"><li data-id="i1">One</li><li data-id="i2">Two</li></ul>`,
      options,
    );

    expect(list!.children).toHaveLength(2);
    expect(findEditableChildren(list!).map(node => node.bindings)).toEqual([
      [{ label: 'Item', property: 'innerText' }],
      [{ label: 'Item', property: 'innerText' }],
    ]);
  });

  it('keeps results with and without a registry apart', () => {
    const source = `<h2 data-id="a">Hello</h2>`;

    expect(extract(source)[0]!.bindings).toEqual([]);
    expect(extract(source, options)[0]!.bindings).toHaveLength(1);
    expect(extract(source)[0]!.bindings).toEqual([]);
  });
});

describe('update with a binding registry', () => {
  const source = `<section>
  <h2 data-id="a">Hello</h2>
  <ui.Button data-id="b" size="small">Go</ui.Button>
</section>`;

  it('commits a registered binding', () => {
    const result = update(source, 'a', 'Heading', 'Hi', 'innerText', options);

    expect(result.success).toBe(true);
    expect(result.code).toContain('<h2 data-id="a">Hi</h2>');
  });

  it('validates against the registry entry', () => {
    expect(
      update(source, 'b', 'Variant', 'solid', 'variant', options).failure,
    ).toMatchObject({ reason: 'binding-not-declared', property: 'variant' });
    expect(
      update(source, 'a', 'Heading', undefined, 'innerText', options).failure,
    ).toMatchObject({ reason: 'required-property' });
  });

  it('reports no binding without the registry, as before', () => {
    expect(update(source, 'a', 'Heading', 'Hi', 'innerText').failure).toEqual({
      reason: 'no-binding',
      dataId: 'a',
    });
  });

  it("validates against the element's own data-binding when it has one", () => {
    const own = `<h2 data-id="a" data-binding={[]}>Hello</h2>`;

    expect(
      update(own, 'a', 'Heading', 'Hi', 'innerText', options).failure,
    ).toMatchObject({ reason: 'binding-not-declared' });
  });

  it('moves registry-bound children', () => {
    const list = `<ul data-id="l"><li data-id="i1">One</li><li data-id="i2">Two</li></ul>`;
    const [node] = extract(list, options);
    const expected = getChildrenSignatures(node!.children!);

    const result = update(
      list,
      'l',
      'Items',
      {
        kind: 'children-edit',
        expected,
        action: { type: 'move', from: 0, to: 1 },
      },
      'children',
      options,
    );

    expect(result.success).toBe(true);
    expect(result.code.indexOf('i2')).toBeLessThan(result.code.indexOf('i1'));
  });

  it('applies several registered edits with updateAll', () => {
    const result = updateAll(
      source,
      [
        { dataId: 'a', label: 'Heading', property: 'innerText', value: 'Hi' },
        { dataId: 'b', label: 'Size', property: 'size', value: 'large' },
      ],
      options,
    );

    expect(result.success).toBe(true);
    expect(result.code).toContain('<h2 data-id="a">Hi</h2>');
    expect(result.code).toContain('size="large"');
  });
});
