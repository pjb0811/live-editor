import { describe, expect, it, vi } from 'vitest';

import {
  findEditableChildren,
  getRegistryBindings,
  isComponentTagName,
} from './binding';
import { getChildrenSignatures } from './children';
import { extract } from './extract';
import type { BindingRegistry } from './types';
import { update, updateAll } from './update';

// A binding registry gives every element of a component the same bindings,
// so the markup only carries a `data-id` (#509).
const registry: BindingRegistry = {
  'ui.Button': [
    { label: 'Text', property: 'innerText' },
    { label: 'Size', property: 'size', widget: { type: 'select' } },
  ],
  Heading: [{ label: 'Heading', property: 'innerText', required: true }],
  List: [{ label: 'Items', property: 'children' }],
  'List.Item': [{ label: 'Item', property: 'innerText' }],
};

const options = { bindings: registry };

describe('getRegistryBindings', () => {
  it('returns the normalized entry for a component, and nothing for others', () => {
    expect(getRegistryBindings(registry, 'ui.Button')).toEqual([
      { label: 'Text', property: 'innerText' },
      { label: 'Size', property: 'size', widget: { type: 'select' } },
    ]);
    expect(getRegistryBindings(registry, 'Paragraph')).toBeUndefined();
    expect(getRegistryBindings(registry, 'constructor')).toBeUndefined();
    expect(getRegistryBindings(undefined, 'Heading')).toBeUndefined();
  });

  it('drops entries an inline data-binding would drop too', () => {
    const loose = { Text: [{ property: 'innerText' }] } as never;

    expect(getRegistryBindings(loose, 'Text')).toEqual([]);
  });

  it('tells components from HTML elements the way JSX does', () => {
    expect(
      [
        'Button',
        'ui.Button',
        'a.b',
        '_Private',
        'p',
        'h2',
        'my-element',
        '',
      ].map(isComponentTagName),
    ).toEqual([true, true, true, true, false, false, false, false]);
  });

  it('ignores HTML element keys, and warns once per registry', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const withElements = {
      p: [{ label: 'Text', property: 'innerText' }],
      Text: [{ label: 'Text', property: 'innerText' }],
    } as BindingRegistry;

    expect(getRegistryBindings(withElements, 'p')).toBeUndefined();
    expect(getRegistryBindings(withElements, 'Text')).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('Ignored: p.');

    warn.mockRestore();
  });

  it('rejects HTML element keys in the type', () => {
    const typed = {
      // @ts-expect-error -- HTML elements aren't registry keys.
      h2: [{ label: 'Heading', property: 'innerText' }],
      Button: [{ label: 'Text', property: 'innerText' }],
    } satisfies BindingRegistry;

    expect(Object.keys(typed)).toHaveLength(2);
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
      `<Heading data-id="a" data-binding={[{ label: 'Title', property: 'title' }]} title="t">x</Heading>
       <Heading data-id="b" data-binding={[]}>y</Heading>`,
      options,
    );

    expect(own!.bindings).toEqual([{ label: 'Title', property: 'title' }]);
    expect(optedOut!.bindings).toEqual([]);
  });

  it('reads children the way the registered binding says', () => {
    const [list] = extract(
      `<List data-id="l"><List.Item data-id="i1">One</List.Item><List.Item data-id="i2">Two</List.Item></List>`,
      options,
    );

    expect(list!.children).toHaveLength(2);
    expect(findEditableChildren(list!).map(node => node.bindings)).toEqual([
      [{ label: 'Item', property: 'innerText' }],
      [{ label: 'Item', property: 'innerText' }],
    ]);
  });

  it('keeps results with and without a registry apart', () => {
    const source = `<Heading data-id="a">Hello</Heading>`;

    expect(extract(source)[0]!.bindings).toEqual([]);
    expect(extract(source, options)[0]!.bindings).toHaveLength(1);
    expect(extract(source)[0]!.bindings).toEqual([]);
  });
});

describe('update with a binding registry', () => {
  const source = `<section>
  <Heading data-id="a">Hello</Heading>
  <p data-id="c">Plain</p>
  <ui.Button data-id="b" size="small">Go</ui.Button>
</section>`;

  it('commits a registered binding', () => {
    const result = update(source, 'a', 'Heading', 'Hi', 'innerText', options);

    expect(result.success).toBe(true);
    expect(result.code).toContain('<Heading data-id="a">Hi</Heading>');
  });

  it('validates against the registry entry', () => {
    expect(
      update(source, 'b', 'Variant', 'solid', 'variant', options).failure,
    ).toMatchObject({ reason: 'binding-not-declared', property: 'variant' });
    expect(
      update(source, 'a', 'Heading', undefined, 'innerText', options).failure,
    ).toMatchObject({ reason: 'required-property' });
  });

  it('never binds an HTML element through the registry', () => {
    const withElements = {
      p: [{ label: 'Text', property: 'innerText' }],
    } as BindingRegistry;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(
      update(source, 'c', 'Text', 'Hi', 'innerText', { bindings: withElements })
        .failure,
    ).toEqual({ reason: 'no-binding', dataId: 'c' });

    warn.mockRestore();
  });

  it('reports no binding without the registry, as before', () => {
    expect(update(source, 'a', 'Heading', 'Hi', 'innerText').failure).toEqual({
      reason: 'no-binding',
      dataId: 'a',
    });
  });

  it("validates against the element's own data-binding when it has one", () => {
    const own = `<Heading data-id="a" data-binding={[]}>Hello</Heading>`;

    expect(
      update(own, 'a', 'Heading', 'Hi', 'innerText', options).failure,
    ).toMatchObject({ reason: 'binding-not-declared' });
  });

  it('moves registry-bound children', () => {
    const list = `<List data-id="l"><List.Item data-id="i1">One</List.Item><List.Item data-id="i2">Two</List.Item></List>`;
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
    expect(result.code).toContain('<Heading data-id="a">Hi</Heading>');
    expect(result.code).toContain('size="large"');
  });
});
