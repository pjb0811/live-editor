import * as t from '@babel/types';
import { describe, expect, it } from 'vitest';

import { clearExtractCache, extract, nodeToJSX } from './extract';
import type { DataAttrNode } from './types';

describe('extract', () => {
  it('returns an empty array for code with no data attributes', () => {
    expect(extract('<div>Hello</div>')).toEqual([]);
  });

  it('extracts a single element and its full field set', () => {
    const [node] = extract(
      `<div data-id="a" data-binding="[{label:'Text',property:'innerText'}]">Hello</div>`,
    );

    expect(node).toMatchObject({
      tagName: 'div',
      textContent: 'Hello',
      bindings: [{ label: 'Text', property: 'innerText' }],
    });
    expect(node!.dataAttributes).toEqual([
      { name: 'data-id', value: 'a', isStringLiteral: true },
      {
        name: 'data-binding',
        value: "[{label:'Text',property:'innerText'}]",
        isStringLiteral: true,
      },
    ]);
    expect(node!.loc).toBeDefined();
  });

  it('extracts sibling top-level elements independently', () => {
    const results = extract(`
      <div data-id="a" data-binding="[{label:'A',property:'innerText'}]">A</div>
      <div data-id="b" data-binding="[{label:'B',property:'innerText'}]">B</div>
    `);

    expect(results).toHaveLength(2);
    expect(results.map(r => r.tagName)).toEqual(['div', 'div']);
    expect(results[0]!.textContent).toBe('A');
    expect(results[1]!.textContent).toBe('B');
  });

  it('does not treat a malformed data-binding value as fatal', () => {
    const [node] = extract(
      `<div data-id="a" data-binding="not valid js">x</div>`,
    );

    expect(node!.bindings).toEqual([]);
  });

  it('resolves member-expression tag names (e.g. ui.Button)', () => {
    const [node] = extract(
      `<ui.Button data-id="a" data-binding="[{label:'Label',property:'label'}]">Click</ui.Button>`,
    );

    expect(node!.tagName).toBe('ui.Button');
  });

  it('extracts a data-binding annotated with `satisfies BindingItem[]`', () => {
    const [node] = extract(
      `<div data-id="a" data-binding={[{ label: 'Text', property: 'innerText' }] satisfies BindingItem[]}>Hello</div>`,
    );

    expect(node!.bindings).toEqual([{ label: 'Text', property: 'innerText' }]);
  });

  it('records rawChildren from generated child code when an innerHTML binding is present', () => {
    const [node] = extract(
      `<span data-id="a" data-binding="[{label:'Html',property:'innerHTML'}]"><b>bold</b> text</span>`,
    );

    expect(node!.rawChildren).toContain('<b>bold</b>');
    expect(node!.rawChildren).toContain('text');
  });

  it('wraps each data-children element in a data-item wrapper, and does not duplicate it at the top level', () => {
    const results = extract(`
      <div data-id="a" data-binding="[{label:'Kids',property:'children'}]">
        <p data-id="inner" data-binding="[{label:'P',property:'innerText'}]">child text</p>
        <span>plain child, no data attrs</span>
      </div>
    `);

    // Only the top-level "a" element is recorded — the children were pulled
    // into its `children` array, not emitted as separate top-level entries.
    expect(results).toHaveLength(1);

    const [parent] = results;
    expect(parent!.children).toHaveLength(2);

    const [wrappedP, wrappedSpan] = parent!.children!;
    expect(wrappedP!.tagName).toBe('div');
    expect(wrappedP!.attributes).toEqual([
      { name: 'data-item', value: 'true' },
    ]);
    expect(wrappedP!.children).toHaveLength(1);
    expect(wrappedP!.children![0]).toMatchObject({
      tagName: 'p',
      textContent: 'child text',
      bindings: [{ label: 'P', property: 'innerText' }],
    });

    // A plain child with no data-* attributes is still wrapped, but its own
    // extracted entry carries no bindings.
    expect(wrappedSpan!.children).toHaveLength(1);
    expect(wrappedSpan!.children![0]).toMatchObject({
      tagName: 'span',
      bindings: [],
    });
  });

  it('recurses into nested data-children regions', () => {
    const results = extract(`
      <div data-id="outer" data-binding="[{label:'Outer',property:'children'}]">
        <div data-id="mid" data-binding="[{label:'Mid',property:'children'}]">
          <em data-id="deep" data-binding="[{label:'Deep',property:'innerText'}]">deep text</em>
        </div>
      </div>
    `);

    expect(results).toHaveLength(1);

    const mid = results[0]!.children![0]!.children![0]!;
    expect(mid.tagName).toBe('div');

    const deep = mid.children![0]!.children![0]!;
    expect(deep).toMatchObject({ tagName: 'em', textContent: 'deep text' });
  });

  it('wraps a JSX fragment inside a data-children region as an isFragment node', () => {
    const results = extract(`
      <div data-id="a" data-binding="[{label:'Kids',property:'children'}]">
        <>
          <p data-id="p1" data-binding="[{label:'P1',property:'innerText'}]">one</p>
          <p data-id="p2" data-binding="[{label:'P2',property:'innerText'}]">two</p>
        </>
      </div>
    `);

    const [fragmentChild] = results[0]!.children!;
    expect(fragmentChild!.isFragment).toBe(true);
    expect(fragmentChild!.tagName).toBe('');
    expect(fragmentChild!.children).toHaveLength(2);
  });

  it('marks JSX elements inside an items array binding as processed so they are not also emitted at the top level', () => {
    const results = extract(`
      <ul
        data-id="list"
        data-binding="[{label:'Items',property:'items',type:'array'}]"
        items={[
          { node: <li data-id="item-1" data-binding="[{label:'T',property:'innerText'}]">one</li> },
        ]}
      >
      </ul>
    `);

    // Only the <ul> itself is recorded — the <li> living inside the items
    // array literal is not independently walked by traverse().
    expect(results).toHaveLength(1);
    expect(results[0]!.tagName).toBe('ul');
  });

  it('caches results by raw source string, and clearExtractCache() invalidates the cache', () => {
    clearExtractCache();
    const code = `<div data-id="a" data-binding="[{label:'A',property:'innerText'}]">A</div>`;

    const first = extract(code);
    const second = extract(code);
    expect(second).toBe(first);

    clearExtractCache();
    const third = extract(code);
    expect(third).not.toBe(first);
    expect(third).toEqual(first);
  });
});

describe('nodeToJSX', () => {
  const makeNode = (overrides: Partial<DataAttrNode> = {}): DataAttrNode => ({
    tagName: 'div',
    attributes: [],
    dataAttributes: [],
    textContent: '',
    ...overrides,
  });

  it('builds a JSX element with attributes and text content', () => {
    const node = makeNode({
      tagName: 'span',
      attributes: [{ name: 'className', value: 'foo', isStringLiteral: true }],
      textContent: 'hi',
    });

    const jsx = nodeToJSX(node);
    expect(jsx).not.toBeNull();
    expect(t.isJSXElement(jsx)).toBe(true);
  });

  it('builds a JSX fragment for isFragment nodes', () => {
    const node = makeNode({
      isFragment: true,
      tagName: '',
      children: [makeNode({ tagName: 'span', textContent: 'child' })],
    });

    const jsx = nodeToJSX(node);
    expect(t.isJSXFragment(jsx)).toBe(true);
  });

  it('unwraps a data-item wrapper div to its single child', () => {
    const wrapper = makeNode({
      tagName: 'div',
      dataAttributes: [{ name: 'data-item', value: 'true' }],
      children: [makeNode({ tagName: 'p', textContent: 'inner' })],
    });

    const jsx = nodeToJSX(wrapper);
    expect(jsx).not.toBeNull();
    expect(
      t.isJSXElement(jsx) && t.isJSXIdentifier(jsx.openingElement.name),
    ).toBe(true);
    expect(
      t.isJSXElement(jsx) &&
        t.isJSXIdentifier(jsx.openingElement.name) &&
        jsx.openingElement.name.name,
    ).toBe('p');
  });

  it('returns null for a data-item wrapper with no children', () => {
    const wrapper = makeNode({
      tagName: 'div',
      dataAttributes: [{ name: 'data-item', value: 'true' }],
    });

    expect(nodeToJSX(wrapper)).toBeNull();
  });
});
