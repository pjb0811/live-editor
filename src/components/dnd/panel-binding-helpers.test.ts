import { describe, expect, it, vi } from 'vitest';

import { type DataAttrNode, extract } from '~/utils/ast';

import { resolvePanelBindings, withPanelCommit } from '.';

const card = `<div data-id="card">
  <h3 data-id="title" data-binding={[{ label: 'Title', property: 'innerText' }]}>First</h3>
  <p data-id="plain">plain</p>
</div>`;

const nodeOf = (id: string): DataAttrNode => {
  const found = extract(card).find(
    node => node.dataAttributes.find(a => a.name === 'data-id')?.value === id,
  );

  expect(found).toBeDefined();

  return found!;
};

// The public path for a node the panel doesn't hand over itself, such as a
// child under `useDndChildren`: resolve, then attach the commit.
describe('resolvePanelBindings + withPanelCommit from the dnd entry', () => {
  it('turns a data-bound node into PanelBindings that commit by id', () => {
    const source = resolvePanelBindings(nodeOf('title'));

    expect(source).toMatchObject({
      id: 'title',
      tagName: 'h3',
      bindings: [
        { id: 'title', label: 'Title', property: 'innerText', value: 'First' },
      ],
    });

    const onNodeChange = vi.fn();
    const [binding] = withPanelCommit(source!.bindings, onNodeChange);

    binding!.onChange('Second');

    expect(onNodeChange).toHaveBeenCalledWith({
      id: 'title',
      label: 'Title',
      property: 'innerText',
      value: 'Second',
    });
  });

  it('returns null for a node that has no data-binding', () => {
    expect(resolvePanelBindings(nodeOf('plain'))).toBeNull();
  });
});

// A binding written on a section's own root resolves like any other element's
// (#429), except for the attributes the editor owns.
describe('resolvePanelBindings on a section root', () => {
  const root = `<section data-id="s1" data-name="Hero" className="py-8" data-binding={[
    { label: 'Padding', property: 'className' },
    { label: 'Id', property: 'data-id' },
    { label: 'Name', property: 'data-name' },
  ]}><h1 data-id="t">x</h1></section>`;

  const sectionNode = () =>
    extract(root).find(node => node.tagName === 'section')!;

  it('reads the root like any other element', () => {
    const source = resolvePanelBindings(sectionNode());

    expect(source).toMatchObject({ id: 's1', tagName: 'section' });
    expect(source!.bindings[0]).toMatchObject({
      label: 'Padding',
      property: 'className',
      value: 'py-8',
    });
  });

  it('marks the attributes the editor owns as not editable', () => {
    const [, id, name] = resolvePanelBindings(sectionNode())!.bindings;

    expect(id).toMatchObject({ property: 'data-id', canEditValue: false });
    expect(name).toMatchObject({ property: 'data-name', canEditValue: false });
  });

  it('leaves an ordinary binding editable', () => {
    const [padding] = resolvePanelBindings(sectionNode())!.bindings;

    expect(padding!.canEditValue).not.toBe(false);
  });

  it('returns null for a section with no data-binding', () => {
    const plain = extract(
      `<section data-id="p" data-name="P"><p>x</p></section>`,
    );

    expect(resolvePanelBindings(plain[0]!)).toBeNull();
  });
});

// What a panel reads to draw an on/off control for an optional attribute
// (#426).
describe('present', () => {
  const el = `<a data-id="a" data-binding={[
    { label: 'Title', property: 'title' },
    { label: 'Alt', property: 'alt' },
    { label: 'Empty', property: 'rel' },
    { label: 'Text', property: 'innerText' },
  ]} title="Hi" rel="">x</a>`;

  const bindings = () => resolvePanelBindings(extract(el)[0]!)!.bindings;
  const byLabel = (label: string) => bindings().find(b => b.label === label)!;

  it('is false for an attribute the element does not carry', () => {
    expect(byLabel('Alt').present).toBe(false);
  });

  it('is left out for an attribute that is there, even an empty one', () => {
    expect(byLabel('Title').present).toBeUndefined();
    expect(byLabel('Empty').present).toBeUndefined();
  });

  it('is left out for content, which is always there', () => {
    expect(byLabel('Text').present).toBeUndefined();
  });

  it('lets an absent attribute be edited, since a value adds it', () => {
    expect(byLabel('Alt')).toMatchObject({ value: '', rawValue: '' });
    expect(byLabel('Alt').canEditValue).not.toBe(false);
  });
});
