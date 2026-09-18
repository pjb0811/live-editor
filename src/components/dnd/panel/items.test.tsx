// @vitest-environment jsdom
import { useState } from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import Items from './items';

const objects = `[{ key: 'a', label: 'Alpha' }, { key: 'b', label: 'Beta' }]`;
const primitives = `['one', 'two']`;

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const addButton = () =>
  screen
    .queryAllByRole('button')
    .find(button => button.textContent?.includes('Add Item')) as
    HTMLButtonElement | undefined;

afterEach(cleanup);

// An array binding is editable only while it holds at least one item: the
// panel edits existing items and never invents the shape of a new one. The
// AST layer already refuses edits that would empty an array
// (`removeArrayItems`), so the only way to reach an empty array is a
// consumer writing `[]` in the source. That state has to explain itself
// instead of showing a permanently dead Add button (#316).
describe('Items panel empty-array contract', () => {
  it('explains the empty array instead of offering a dead Add button', () => {
    render(<Items value="[]" />);

    expect(addButton()).toBeUndefined();
    expect(screen.getByText(/no editable items/i)).not.toBeNull();
  });

  it('never commits from the empty state', () => {
    const onChange = vi.fn();
    render(<Items value="[]" onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers Add once the array holds an item, for both kinds', () => {
    const { unmount } = render(<Items value={objects} />);
    expect(addButton()?.disabled).toBe(false);
    unmount();

    render(<Items value={primitives} />);
    expect(addButton()?.disabled).toBe(false);
  });

  it('keeps the last item undeletable, so the array cannot be emptied here', () => {
    render(<Items value={`[{ key: 'only' }]`} />);

    const deletes = screen
      .getAllByRole('button')
      .filter(button => button.querySelector('.lucide-x'));

    expect(deletes).toHaveLength(1);
    expect((deletes[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('distinguishes a parse failure from an empty array', () => {
    render(<Items value="not an array" />);

    expect(screen.getByText(/could not be read as a list/i)).not.toBeNull();
    expect(screen.queryByText(/no editable items/i)).toBeNull();
    expect(addButton()).toBeUndefined();
  });
});

describe('Items', () => {
  it('keeps untouched item subtrees mounted when another item changes', () => {
    const first = `[{ label: 'A' }, { label: 'B' }]`;
    const second = `[{ label: 'A' }, { label: 'BB' }]`;
    const { container, rerender } = render(<Items value={first} />);
    const before = container.querySelectorAll('textarea');

    expect(before).toHaveLength(2);

    rerender(<Items value={second} />);

    const after = container.querySelectorAll('textarea');

    expect(after[0]).toBe(before[0]);
  });

  it('moves item subtrees with their source item', () => {
    const before = `[{ label: 'A' }, { label: 'B' }]`;
    const after = `[{ label: 'B' }, { label: 'A' }]`;
    const { container, rerender } = render(<Items value={before} />);
    const nodeOfA = container.querySelectorAll('textarea')[0]!;

    rerender(<Items value={after} />);

    const nodes = [...container.querySelectorAll('textarea')];

    expect(nodes.indexOf(nodeOfA)).toBe(1);
  });

  it('keeps surviving item subtrees after a delete', () => {
    const before = `[{ label: 'A' }, { label: 'B' }, { label: 'C' }]`;
    const after = `[{ label: 'B' }, { label: 'C' }]`;
    const { container, rerender } = render(<Items value={before} />);
    const [, nodeOfB, nodeOfC] = container.querySelectorAll('textarea');

    rerender(<Items value={after} />);

    const nodes = [...container.querySelectorAll('textarea')];

    expect(nodes[0]).toBe(nodeOfB);
    expect(nodes[1]).toBe(nodeOfC);
  });

  it('keeps the original subtree when duplicating an item through the panel', () => {
    const ControlledItems = () => {
      const [value, setValue] = useState(`[{ label: 'A' }]`);

      return <Items value={value} onChange={setValue} />;
    };

    const { container } = render(<ControlledItems />);
    const nodeOfOriginal = container.querySelector('textarea')!;

    fireEvent.click(addButton()!);

    const nodes = [...container.querySelectorAll('textarea')];

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toBe(nodeOfOriginal);
    expect(nodes[1]).not.toBe(nodeOfOriginal);
  });
});
