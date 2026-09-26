// @vitest-environment jsdom
import { useState } from 'react';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { extract, update } from '~/utils/ast';

import Children from './children';

const first = `<p data-id="a" data-binding={[{label:'Title',property:'innerText'}]}>A</p>`;
const second = `<p data-id="b" data-binding={[{label:'Title',property:'innerText'}]}>B</p>`;
const gap = `{flag && <em>keep</em>}{/* comment */} text `;
const source = `<div data-id="parent" data-binding={[{label:'Children',property:'children'}]}>${first}${gap}${second}</div>`;

const Harness = () => {
  const [code, setCode] = useState(source);
  const commit = (
    id: string,
    label: string,
    value: unknown,
    property: string,
  ) => {
    const result = update(code, id, label, value, property);

    if (result.success) {
      setCode(result.code);
    }
  };

  return (
    <>
      <Children
        value={extract(code)[0]!.children ?? []}
        onChange={value => commit('parent', 'Children', value, 'children')}
        onNodeChange={({ id, label, value, property }) =>
          commit(id, label, value, property)
        }
      />
      <output data-testid="source">{code}</output>
    </>
  );
};

afterEach(cleanup);

describe('Children panel integration', () => {
  it('moves, copies, deletes, then edits a nested binding using the copied identity', async () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]!);
    fireEvent.click(screen.getByTitle('Move selected up'));
    await waitFor(() =>
      expect(screen.getByTestId('source').textContent).toContain(
        `${second}${gap}${first}`,
      ),
    );
    // The moved child stays selected at its new position (#342), so the
    // bulk actions stay available for it.
    expect(
      screen
        .getAllByRole('checkbox')
        .map(box => box.getAttribute('aria-checked')),
    ).toEqual(['true', 'false']);

    fireEvent.click(screen.getByTitle('Duplicate selected'));
    await waitFor(() => expect(screen.getAllByRole('textbox')).toHaveLength(3));
    fireEvent.click(screen.getAllByTitle('Delete item')[0]!);
    await waitFor(() => expect(screen.getAllByRole('textbox')).toHaveLength(2));
    const copied = screen.getAllByRole('textbox')[1]!;
    fireEvent.change(copied, { target: { value: 'Edited copy' } });
    fireEvent.blur(copied);
    const code = screen.getByTestId('source').textContent!;

    expect(code).toContain(gap);
    expect(code).toContain(first);
    expect(code).not.toContain('data-id="b"');
    expect(code).toContain('>Edited copy</p>');
    expect(code.match(/data-id="[^"]+"/g)).toHaveLength(3);
  });
});
