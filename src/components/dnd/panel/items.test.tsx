// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Items from './items';

const objects = `[{ key: 'a', label: 'Alpha' }, { key: 'b', label: 'Beta' }]`;
const primitives = `['one', 'two']`;

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
