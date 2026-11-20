// @vitest-environment jsdom
import { useState } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { BindingKeyMap } from '~/utils/ast/types';

import { PreviewContext } from '../context/states';
import Dnd from './dnd';
import type { DndEditError } from './edit-options';
import { Canvas, Panel } from './layout';
import { useDndDocument } from './layout-context';
import type { DndDocument } from './types';

// No section needs to compile here.
vi.mock('./canvas/renderer', () => ({
  default: () => <div data-testid="renderer" />,
}));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

const DOC = `const settings = {
  theme: 'dark',
  delay: 5000,
  id: make(),
};

const App = () => (
  <main id="app-container">
    <section data-id="s1" data-name="One"><p>one</p></section>
  </main>
);

export default App;`;

// Defined once, as the docs ask.
const DOCUMENT_BINDINGS: BindingKeyMap = {
  settings: [
    { label: 'Theme', property: 'theme' },
    { label: 'Delay', property: 'delay', type: 'number', min: 1000 },
    { label: 'ID', property: 'id' },
    { label: 'Missing', property: 'missing' },
  ],
};

const createHarness = () => {
  let api: DndDocument | undefined;
  let setDocument: ((code: string) => void) | undefined;

  const Probe = () => {
    api = useDndDocument();

    return null;
  };

  const Editor = ({
    onCode,
    onEditError,
  }: {
    onCode?: (code: string, change: unknown) => void;
    onEditError?: (error: DndEditError) => void;
  }) => {
    const [value, setValue] = useState(DOC);

    setDocument = setValue;

    return (
      <PreviewContext.Provider value={{ code: '', setCode: () => {} }}>
        <Dnd
          value={value}
          onChange={(next, change) => {
            setValue(next);
            onCode?.(next, change);
          }}
          onEditError={onEditError}
          documentBindings={DOCUMENT_BINDINGS}
        >
          <Probe />
          <Canvas />
          <Panel />
        </Dnd>
      </PreviewContext.Provider>
    );
  };

  return {
    Editor,
    api: () => api!,
    setDocument: (code: string) => setDocument!(code),
  };
};

describe('useDndDocument', () => {
  it('reads the declared keys of the settings object', () => {
    const { Editor, api } = createHarness();

    render(<Editor />);

    expect(
      api().bindings.map(
        ({ id, property, value, rawValue, canEditValue, present }) => ({
          id,
          property,
          value,
          rawValue,
          canEditValue,
          present,
        }),
      ),
    ).toEqual([
      {
        id: 'settings',
        property: 'theme',
        value: 'dark',
        rawValue: 'dark',
        canEditValue: undefined,
        present: undefined,
      },
      {
        id: 'settings',
        property: 'delay',
        value: 5000,
        rawValue: '5000',
        canEditValue: undefined,
        present: undefined,
      },
      {
        id: 'settings',
        property: 'id',
        value: 'make()',
        rawValue: 'make()',
        canEditValue: false,
        present: undefined,
      },
      {
        id: 'settings',
        property: 'missing',
        value: '',
        rawValue: '',
        canEditValue: false,
        present: false,
      },
    ]);
    expect(api().readOnly).toBe(false);
  });

  it('commits an edit once, as a dnd change, in place', () => {
    const onCode = vi.fn();
    const { Editor, api } = createHarness();

    render(<Editor onCode={onCode} />);
    act(() => api().bindings[0]!.onChange('light'));

    expect(onCode).toHaveBeenCalledExactlyOnceWith(
      DOC.replace("'dark'", "'light'"),
      { source: 'dnd' },
    );
    expect(api().bindings[0]!.value).toBe('light');
  });

  it('reports a refused edit and commits nothing', () => {
    const onCode = vi.fn();
    const onEditError = vi.fn();
    const { Editor, api } = createHarness();

    render(<Editor onCode={onCode} onEditError={onEditError} />);
    act(() => api().bindings[2]!.onChange('x'));

    expect(onCode).not.toHaveBeenCalled();
    expect(onEditError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        type: 'document',
        name: 'settings',
        property: 'id',
        failure: {
          reason: 'unsupported-syntax',
          name: 'settings',
          property: 'id',
        },
        title: 'Cannot edit "ID" in the panel',
      }),
    );
  });

  it('keeps the fields read-only while the document does not parse', () => {
    const onCode = vi.fn();
    const onEditError = vi.fn();
    const { Editor, api, setDocument } = createHarness();

    render(<Editor onCode={onCode} onEditError={onEditError} />);
    act(() => setDocument(DOC.replace('</main>', '')));

    expect(api().readOnly).toBe(true);
    expect(api().bindings[0]!.value).toBe('dark');

    act(() => api().bindings[0]!.onChange('light'));

    expect(onCode).not.toHaveBeenCalled();
    expect(onEditError).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'parse', target: 'document' }),
    );
  });
});

describe('the built-in panel with documentBindings', () => {
  it('shows the settings while no section is selected, and checks constraints', () => {
    const onCode = vi.fn();
    const { Editor } = createHarness();

    render(<Editor onCode={onCode} />);

    expect(screen.getByText('Document')).not.toBeNull();
    expect(screen.getByRole('group', { name: 'settings' })).not.toBeNull();

    const delay = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.change(delay, { target: { value: '10' } });
    fireEvent.blur(delay);

    expect(onCode).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(
      'Must be at least 1000.',
    );

    fireEvent.change(delay, { target: { value: '2000' } });
    fireEvent.blur(delay);

    expect(onCode).toHaveBeenCalledExactlyOnceWith(
      DOC.replace('5000', '2000'),
      { source: 'dnd' },
    );
  });

  it('hides them while a section is selected', () => {
    const { Editor } = createHarness();
    const { container } = render(<Editor />);

    act(() =>
      container
        .querySelector<HTMLElement>('[aria-roledescription="sortable"]')!
        .click(),
    );

    expect(screen.queryByText('Document')).toBeNull();
  });
});
