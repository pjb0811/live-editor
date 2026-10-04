import { describe, expect, it, vi } from 'vitest';

import {
  findEditableChildren,
  getKeyBindings,
  getRegistryBindings,
  isComponentTagName,
} from './binding';
import { getChildrenSignatures } from './children';
import { extract } from './extract';
import type { BindingKeyMap, BindingRegistry } from './types';
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

// Bindings an element names with `data-binding-key`, on HTML elements and
// components alike (#513).
describe('binding keys', () => {
  const bindingKeys: BindingKeyMap = {
    'hero-title': [
      { label: 'Hero Title', property: 'innerText', required: true },
    ],
    'hero-cta': [
      { label: 'CTA Text', property: 'innerText' },
      { label: 'CTA Link', property: 'href', type: 'url' },
    ],
    'card-list': [{ label: 'Cards', property: 'children' }],
    'card-title': [{ label: 'Card Title', property: 'innerText' }],
  };
  const keyed = { bindings: registry, bindingKeys };

  it('gives an HTML element the entry its key names', () => {
    const [title, cta] = extract(
      `<h1 data-id="t" data-binding-key="hero-title">Hi</h1>
       <a data-id="c" data-binding-key="hero-cta" href="/go">Go</a>`,
      keyed,
    );

    expect(title!.bindings).toEqual([
      { label: 'Hero Title', property: 'innerText', required: true },
    ]);
    expect(cta!.bindings!.map(binding => binding.label)).toEqual([
      'CTA Text',
      'CTA Link',
    ]);
    expect(getKeyBindings(bindingKeys, 'nope')).toBeUndefined();
  });

  it("takes precedence over the component's registry entry", () => {
    const [button] = extract(
      `<ui.Button data-id="b" data-binding-key="hero-cta" href="/go">Go</ui.Button>`,
      keyed,
    );

    expect(button!.bindings!.map(binding => binding.label)).toEqual([
      'CTA Text',
      'CTA Link',
    ]);
  });

  it('gives way to an own data-binding, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [title] = extract(
      `<h1 data-id="t" data-binding-key="hero-title" data-binding={[{ label: 'Own', property: 'title' }]} title="x">Hi</h1>`,
      keyed,
    );

    expect(title!.bindings).toEqual([{ label: 'Own', property: 'title' }]);
    expect(warn.mock.calls[0]![0]).toContain('both data-binding');

    warn.mockRestore();
  });

  it('gives no fields for a missing key, without falling back to the registry', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [button] = extract(
      `<ui.Button data-id="b" data-binding-key="not-there">Go</ui.Button>`,
      keyed,
    );

    expect(button!.bindings).toEqual([]);
    expect(warn.mock.calls[0]![0]).toContain(
      '"not-there" isn\'t in bindingKeys',
    );

    extract(`<p data-id="p" data-binding-key="not-there">x</p>`, keyed);
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('gives no fields for a key that is not a plain string', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [title] = extract(
      `<h1 data-id="t" data-binding-key={name}>Hi</h1>`,
      keyed,
    );

    expect(title!.bindings).toEqual([]);
    expect(warn.mock.calls[0]![0]).toContain('must be a plain string');

    warn.mockRestore();
  });

  it('reads children through a keyed children binding', () => {
    const [list] = extract(
      `<div data-id="l" data-binding-key="card-list">
         <h3 data-id="c1" data-binding-key="card-title">One</h3>
         <h3 data-id="c2" data-binding-key="card-title">Two</h3>
       </div>`,
      keyed,
    );

    expect(list!.children).toHaveLength(2);
    expect(findEditableChildren(list!)).toHaveLength(2);
  });

  it('keeps results with and without keys apart', () => {
    const source = `<h1 data-id="t" data-binding-key="hero-title">Hi</h1>`;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(extract(source, { bindings: registry })[0]!.bindings).toEqual([]);
    expect(extract(source, keyed)[0]!.bindings).toHaveLength(1);

    warn.mockRestore();
  });

  it('commits and validates a keyed field with update and updateAll', () => {
    const source = `<section>
  <h1 data-id="t" data-binding-key="hero-title">Hi</h1>
  <a data-id="c" data-binding-key="hero-cta" href="/go">Go</a>
</section>`;

    expect(
      update(source, 't', 'Hero Title', 'Hello', 'innerText', keyed).code,
    ).toContain('<h1 data-id="t" data-binding-key="hero-title">Hello</h1>');
    expect(
      update(source, 't', 'Hero Title', undefined, 'innerText', keyed).failure,
    ).toMatchObject({ reason: 'required-property' });
    expect(
      update(source, 'c', 'Title', 'x', 'title', keyed).failure,
    ).toMatchObject({ reason: 'binding-not-declared' });

    const result = updateAll(
      source,
      [
        { dataId: 't', label: 'Hero Title', property: 'innerText', value: 'A' },
        { dataId: 'c', label: 'CTA Link', property: 'href', value: '/b' },
      ],
      keyed,
    );

    expect(result.success).toBe(true);
    expect(result.code).toContain('href="/b"');
  });

  it('reports no binding for a keyed element without the map', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const source = `<h1 data-id="t" data-binding-key="only-in-map">Hi</h1>`;

    expect(update(source, 't', 'Title', 'x', 'innerText').failure).toEqual({
      reason: 'no-binding',
      dataId: 't',
    });

    warn.mockRestore();
  });

  it('never lets a binding rewrite data-binding-key', () => {
    const source = `<h1 data-id="t" data-binding-key="reserved">Hi</h1>`;
    const reserved = {
      bindingKeys: {
        reserved: [{ label: 'Key', property: 'data-binding-key' }],
      },
    };

    expect(
      update(source, 't', 'Key', 'other', 'data-binding-key', reserved).failure,
    ).toEqual({
      reason: 'reserved-property',
      dataId: 't',
      property: 'data-binding-key',
    });
  });

  // Typed with `satisfies`, so this also checks that the schema types take
  // keys of the app's own.
  it('passes keys of its own through to meta, in both maps', () => {
    const withMeta = {
      bindings: {
        'ui.Button': [
          { label: 'Text', property: 'innerText', group: 'Button' },
        ],
      } satisfies BindingRegistry,
      bindingKeys: {
        title: [
          {
            label: 'Title',
            property: 'innerText',
            tab: 'Content',
            visible: { property: 'mode', in: ['on'] },
          },
        ],
      } satisfies BindingKeyMap,
    };
    const [title, button] = extract(
      `<h1 data-id="t" data-binding-key="title">Hi</h1>
       <ui.Button data-id="b">Go</ui.Button>`,
      withMeta,
    );

    expect(title!.bindings).toEqual([
      {
        label: 'Title',
        property: 'innerText',
        meta: { tab: 'Content', visible: { property: 'mode', in: ['on'] } },
      },
    ]);
    expect(button!.bindings).toEqual([
      { label: 'Text', property: 'innerText', meta: { group: 'Button' } },
    ]);
  });
});
