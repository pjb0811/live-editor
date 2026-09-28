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
