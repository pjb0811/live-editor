// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { extract } from '~/utils/ast';

import Children from './children';
import Items from './items';

const three = `[{ label: 'A' }, { label: 'B' }, { label: 'C' }]`;

const selectAll = () => screen.getByRole('checkbox', { name: 'Select all' });
const rowBoxes = () =>
  screen
    .getAllByRole('checkbox')
    .filter(box => box !== selectAll() && !selectAll().contains(box));
const stateOf = (box: HTMLElement) => box.getAttribute('aria-checked');

afterEach(cleanup);

// Select or clear every row at once (#638).
describe('select all in the Items editor', () => {
  it('starts unchecked, and selects every row', () => {
    render(<Items value={three} />);

    expect(stateOf(selectAll())).toBe('false');

    fireEvent.click(selectAll());

    expect(screen.getByText('3 selected')).not.toBeNull();
    expect(stateOf(selectAll())).toBe('true');
  });

  it('shows some rows selected as indeterminate, and selects the rest', () => {
    render(<Items value={three} />);

    fireEvent.click(rowBoxes()[0]!);

    expect(stateOf(selectAll())).toBe('mixed');

    fireEvent.click(selectAll());

    expect(screen.getByText('3 selected')).not.toBeNull();
  });

  it('clears the selection once every row is selected', () => {
    render(<Items value={three} />);

    fireEvent.click(selectAll());
    fireEvent.click(selectAll());

    expect(screen.queryByText(/selected$/)).toBeNull();
    expect(stateOf(selectAll())).toBe('false');
  });

  it('disables duplicate after selecting all at maxItems', () => {
    render(<Items value={three} maxItems={4} />);

    fireEvent.click(selectAll());

    expect(
      (screen.getByTitle('Duplicate selected') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('is disabled while the array can only be edited in code', () => {
    render(<Items value={`[{ label: 'A' }, ...rest]`} />);

    expect(selectAll().getAttribute('aria-disabled')).toBe('true');
  });

  it('works with the keyboard', () => {
    render(<Items value={three} />);

    selectAll().focus();
    fireEvent.keyDown(selectAll(), { key: ' ', code: 'Space' });
    fireEvent.keyUp(selectAll(), { key: ' ', code: 'Space' });

    expect(screen.getByText('3 selected')).not.toBeNull();
  });
});

describe('select all in the Children editor', () => {
  it('selects and clears every child', () => {
    const child = (id: string) =>
      `<p data-id="${id}" data-binding={[{label:'Title',property:'innerText'}]}>${id}</p>`;
    const children =
      extract(
        `<div data-id="parent" data-binding={[{label:'Children',property:'children'}]}>${child('a')}${child('b')}</div>`,
      )[0]!.children ?? [];

    render(<Children value={children} />);

    fireEvent.click(selectAll());

    expect(screen.getByText('2 selected')).not.toBeNull();

    fireEvent.click(selectAll());

    expect(screen.queryByText(/selected$/)).toBeNull();
  });
});
