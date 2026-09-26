// @vitest-environment jsdom
import { render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type DataAttrNode, extract, fillIds, parseBinding } from '~/utils/ast';

import {
  type PanelBinding,
  type PanelBindingData,
  resolvePanelBindings,
  withPanelCommit,
} from './panel-binding';
import Node from './panel/node';
import { useItemsEditor } from './panel/use-items-editor';

// Captures what `Node` hands to the built-in control, which is the only way
// to read the custom-panel path's binding without asserting on rendered
// markup that belongs to `Field`'s own tests.
const captured = vi.hoisted(() => [] as PanelBinding[]);

vi.mock('./panel/field', () => ({
  default: ({ binding }: { binding: PanelBinding }) => {
    captured.push(binding);
    return null;
  },
}));

// Every field `PanelBinding` declares, authored at once. If a new field is
// added to the interface but only wired into one of the three panel paths,
// the agreement test below fails rather than the omission shipping.
const fullBinding = `[{
  label: 'Title',
  property: 'innerText',
  type: 'string',
  widget: { type: 'slider', step: 4, unit: 'px' },
  options: [{ label: 'One', value: '1' }],
  render: { nested: { type: 'number' } },
  min: 2,
  max: 20,
  pattern: '^[A-Z]',
  required: true,
  group: 'content',
  order: 3,
}]`;

const element = `<p data-id="t1" data-binding={${fullBinding}}>Open</p>`;

const nodeOf = (jsx: string, id: string): DataAttrNode => {
  const found = extract(fillIds(jsx)).find(
    node => node.dataAttributes.find(a => a.name === 'data-id')?.value === id,
  );

  expect(found).toBeDefined();

  return found!;
};

describe('resolvePanelBindings', () => {
  it('carries every declared field through to the panel binding', () => {
    const source = resolvePanelBindings(nodeOf(element, 't1'))!;

    expect(source.id).toBe('t1');
    expect(source.tagName).toBe('p');
    expect(source.bindings).toHaveLength(1);
    expect(source.bindings[0]).toEqual({
      id: 't1',
      label: 'Title',
      property: 'innerText',
      type: 'string',
      widget: { type: 'slider', step: 4, unit: 'px' },
      options: [{ label: 'One', value: '1' }],
      render: { nested: { type: 'number' } },
      min: 2,
      max: 20,
      pattern: '^[A-Z]',
      required: true,
      meta: { group: 'content', order: 3 },
      value: 'Open',
      rawValue: 'Open',
    });
  });

  it('keeps consumer-defined meta keys intact', () => {
    const source = resolvePanelBindings(
      nodeOf(
        `<p data-id="m1" data-binding={[{ label: 'T', property: 'innerText', anything: { deep: [1, 2] } }]}>x</p>`,
        'm1',
      ),
    )!;

    expect(source.bindings[0]!.meta).toEqual({ anything: { deep: [1, 2] } });
  });

  it('delivers `value` as its real JS type next to the raw source', () => {
    const source = resolvePanelBindings(
      nodeOf(
        `<input data-id="n1" data-binding={[{ label: 'Count', property: 'count', type: 'number' }]} count={42} />`,
        'n1',
      ),
    )!;

    expect(source.bindings[0]!.value).toBe(42);
    expect(source.bindings[0]!.rawValue).toBe('42');
  });

  it.each([
    ['an external reference', 'value={theme.value}'],
    ['a call expression', 'value={getValue()}'],
    ['an object spread', 'value={{ ...defaults, label: "A" }}'],
    ['a sparse array outside the Items editor', 'value={[, "A"]}'],
  ])('marks %s as code-editor-only', (_, attribute) => {
    const source = resolvePanelBindings(
      nodeOf(
        `<Comp data-id="dynamic" data-binding={[{ label: 'Value', property: 'value' }]} ${attribute} />`,
        'dynamic',
      ),
    )!;

    expect(source.bindings[0]!.canEditValue).toBe(false);
  });

  it('keeps literal attributes and source-safe array editors enabled', () => {
    const source = resolvePanelBindings(
      nodeOf(
        `<Comp data-id="safe" data-binding={[
          { label: 'Style', property: 'style' },
          { label: 'Rows', property: 'items', type: 'array' }
        ]} style={{ color: 'red' }} items={[, ...rows, { label: 'A' }]} />`,
        'safe',
      ),
    )!;

    expect(source.bindings.map(binding => binding.canEditValue)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('reuses bindings already parsed by extract instead of the attribute text', () => {
    const node = nodeOf(element, 't1');
    const reused: DataAttrNode = {
      ...node,
      bindings: [{ label: 'Reused', property: 'innerText' }],
    };

    expect(resolvePanelBindings(reused)!.bindings[0]!.label).toBe('Reused');
  });

  it('returns null for anything not editable', () => {
    const noBinding = nodeOf(`<p data-id="a">x</p>`, 'a');
    expect(resolvePanelBindings(noBinding)).toBeNull();

    const emptyBinding = nodeOf(`<p data-id="b" data-binding={[]}>x</p>`, 'b');
    expect(resolvePanelBindings(emptyBinding)).toBeNull();

    expect(
      resolvePanelBindings({
        tagName: 'p',
        attributes: [],
        dataAttributes: [{ name: 'data-binding', value: fullBinding }],
        textContent: 'x',
      }),
    ).toBeNull();
  });

  it('falls back to `element` when the node has no tag name', () => {
    const node = nodeOf(element, 't1');

    expect(resolvePanelBindings({ ...node, tagName: '' })!.tagName).toBe(
      'element',
    );
  });
});

describe('withPanelCommit', () => {
  it('addresses the commit by id and property, never by label alone', () => {
    const commit = vi.fn();
    const source = resolvePanelBindings(nodeOf(element, 't1'))!;

    withPanelCommit(source.bindings, commit)[0]!.onChange('Next');

    expect(commit).toHaveBeenCalledWith({
      id: 't1',
      label: 'Title',
      property: 'innerText',
      value: 'Next',
    });
  });

  it('leaves the read data untouched so it stays safe to memoize', () => {
    const source = resolvePanelBindings(nodeOf(element, 't1'))!;
    const before = structuredClone(source.bindings);

    withPanelCommit(source.bindings, vi.fn());

    expect(source.bindings).toEqual(before);
    expect(source.bindings[0]).not.toHaveProperty('onChange');
  });

  // The #336 hazard in miniature: read once, then bind a different commit.
  // Whichever commit was supplied last is the one that must run.
  it('binds the commit supplied at call time, not an earlier one', () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const source = resolvePanelBindings(nodeOf(element, 't1'))!;

    withPanelCommit(source.bindings, stale);
    withPanelCommit(source.bindings, fresh)[0]!.onChange('Next');

    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no commit is supplied', () => {
    const source = resolvePanelBindings(nodeOf(element, 't1'))!;

    expect(() =>
      withPanelCommit(source.bindings, undefined)[0]!.onChange('Next'),
    ).not.toThrow();
  });
});

// #340: the built-in panel, a custom panel and the nested item editor each
// used to hand-repeat this conversion, so a field could reach one path and
// not the others. Same element, three entry points, identical data.
describe('panel paths agree on the same element', () => {
  const strip = (binding: PanelBindingData & { onChange?: unknown }) => {
    const { onChange: _onChange, ...data } = binding;
    return data;
  };

  it('resolves identically for the direct, custom-panel and nested paths', () => {
    const direct = resolvePanelBindings(nodeOf(element, 't1'))!.bindings[0]!;

    // The custom-panel path: `Node` resolves the binding and hands it to
    // `Field`, which the mock above captures verbatim.
    captured.length = 0;
    render(<Node data={nodeOf(element, 't1')} />);
    const fromNode = captured[0]!;

    // The nested path: the same element inside an item's JSX-valued
    // property, which `extract()` never walks into (#308).
    const { result } = renderHook(() =>
      useItemsEditor(`[{ key: 'row', children: (<div>${element}</div>) }]`),
    );

    const nested = result.current.items[0]!.nested.find(
      group => group.property === 'children',
    )!;
    const fromItems = nested.elements[0]!.bindings[0]!;

    expect(strip(fromNode)).toEqual(strip(direct));
    expect(strip(fromItems)).toEqual(strip(direct));

    // Spelled out rather than left to the comparison above: a conversion
    // that dropped `meta`/`widget` in all three paths at once would still
    // satisfy an equality check (#234, #236).
    expect(fromItems.meta).toEqual({ group: 'content', order: 3 });
    expect(fromNode.widget).toEqual({ type: 'slider', step: 4, unit: 'px' });
  });

  // The fourth path (#383): the same field spec declared as a render-map leaf
  // of an `array` binding, rather than as a top-level binding. Its value comes
  // from an array element, not an attribute, so only the declared fields are
  // compared — those must arrive exactly as the direct path delivers them.
  it('resolves a render-map leaf with the same declared fields', () => {
    const direct = resolvePanelBindings(nodeOf(element, 't1'))!.bindings[0]!;
    const spec = fullBinding.trim().slice(1, -1);
    const [items] = parseBinding(
      `[{ label: 'Rows', property: 'items', type: 'array', render: { title: ${spec} } }]`,
    );
    const { result } = renderHook(() =>
      useItemsEditor(`[{ title: 'Open' }]`, { render: items!.render }),
    );
    const fromLeaf = result.current.items[0]!.properties[0]!;

    const declared = (binding: PanelBindingData) => {
      const {
        id: _id,
        value: _value,
        rawValue: _rawValue,
        canEditValue: _canEditValue,
        meta,
        ...fields
      } = binding;

      return { ...fields, meta: { ...meta, valueType: undefined } };
    };

    expect(declared(strip(fromLeaf))).toEqual(declared(strip(direct)));
    expect(fromLeaf.meta).toEqual({
      group: 'content',
      order: 3,
      valueType: 'string',
    });
  });

  it("falls back to the key for a leaf's label and property", () => {
    const [items] = parseBinding(
      `[{ label: 'Rows', property: 'items', type: 'array', render: { size: { type: 'not-a-type', valueType: 'spoofed' } } }]`,
    );
    const { result } = renderHook(() =>
      useItemsEditor(`[{ size: 12 }]`, { render: items!.render }),
    );
    const leaf = result.current.items[0]!.properties[0]!;

    expect(leaf.label).toBe('size');
    expect(leaf.property).toBe('size');
    expect(leaf.type).toBeUndefined();
    // The library's own `valueType` wins over an authored one.
    expect(leaf.meta).toEqual({ valueType: 'number' });
  });

  it('commits through every path with the same id and property', () => {
    const commit = vi.fn();

    captured.length = 0;
    render(<Node data={nodeOf(element, 't1')} onChange={commit} />);
    captured[0]!.onChange('From node');

    expect(commit).toHaveBeenCalledWith({
      id: 't1',
      label: 'Title',
      property: 'innerText',
      value: 'From node',
    });
  });
});
