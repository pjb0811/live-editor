// @vitest-environment jsdom
import { useState } from 'react';

import { act, render } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Section } from '~/types';

import { PreviewContext } from '../context/states';
import Dnd from './dnd';
import { Canvas } from './layout';
import { useDndSections } from './layout-context';
import type { DndSections } from './types';

// Same reason as dnd.test.tsx: no section needs to compile here.
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

const documentOf = (body: string) => `
const App = () => {
  return (
    <main id="app-container">${body}</main>
  )
}

export default App;
`;

const sectionsOf = (...ids: string[]) =>
  ids
    .map(id => `<section data-id="${id}" data-name="${id}">${id}</section>`)
    .join('');

const ABC = documentOf(sectionsOf('a', 'b', 'c'));

// An editor that keeps its own `value`, with a probe on `useDndSections()`.
// `latest` reads what the hook returned on the last render.
const createHarness = () => {
  let api: DndSections | undefined;
  let setDocument: ((code: string) => void) | undefined;

  const Probe = () => {
    api = useDndSections();

    return null;
  };

  const Editor = ({
    initial,
    onBeforeDelete,
    onSelectionChange,
    onCode,
  }: {
    initial: string;
    onBeforeDelete?: (section: Section) => boolean | Promise<boolean>;
    onSelectionChange?: (section: Section | null) => void;
    onCode?: (code: string) => void;
  }) => {
    const [value, setValue] = useState(initial);

    setDocument = setValue;

    return (
      <PreviewContext.Provider value={{ code: '', setCode: () => {} }}>
        <Dnd
          value={value}
          onChange={next => {
            setValue(next);
            onCode?.(next);
          }}
          onBeforeDelete={onBeforeDelete}
          onSelectionChange={onSelectionChange}
        >
          <Probe />
          <Canvas />
        </Dnd>
      </PreviewContext.Provider>
    );
  };

  return {
    Editor,
    latest: {
      get api() {
        return api!;
      },
      setDocument: (code: string) => setDocument!(code),
    },
  };
};

let { Editor, latest } = createHarness();

beforeEach(() => {
  ({ Editor, latest } = createHarness());
});

const ids = () => latest.api.sections.map(section => section.id);

describe('useDndSections', () => {
  it('lists the sections in document order', () => {
    render(<Editor initial={ABC} />);

    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(latest.api.sections[1]).toMatchObject({ id: 'b', name: 'b' });
    expect(latest.api.selectedId).toBeNull();
    expect(latest.api.readOnly).toBe(false);
  });

  it('selects without toggling, ignores an unknown id, and clears on null', () => {
    render(<Editor initial={ABC} />);

    act(() => latest.api.select('b'));
    expect(latest.api.selectedId).toBe('b');

    act(() => latest.api.select('b'));
    expect(latest.api.selectedId).toBe('b');

    act(() => latest.api.select('missing'));
    expect(latest.api.selectedId).toBe('b');

    act(() => latest.api.select(null));
    expect(latest.api.selectedId).toBeNull();
  });

  it('scrolls the selected section into view', async () => {
    const scrollIntoView = vi.fn();

    Element.prototype.scrollIntoView = scrollIntoView;
    render(<Editor initial={ABC} />);

    act(() => latest.api.select('c'));
    await act(
      () => new Promise(resolve => requestAnimationFrame(() => resolve(null))),
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  // None of these is the selected section, which the panel's callbacks
  // can't reach.
  it('moves a section that is not selected', () => {
    render(<Editor initial={ABC} />);

    act(() => latest.api.select('a'));
    act(() => latest.api.move('c', 'up'));
    expect(ids()).toEqual(['a', 'c', 'b']);

    act(() => latest.api.move('a', 'up'));
    expect(ids()).toEqual(['a', 'c', 'b']);

    act(() => latest.api.moveTo('b', 0));
    expect(ids()).toEqual(['b', 'a', 'c']);

    act(() => latest.api.moveTo('b', 99));
    expect(ids()).toEqual(['a', 'c', 'b']);
    expect(latest.api.selectedId).toBe('a');
  });

  it('duplicates a section below itself and selects the copy', () => {
    render(<Editor initial={ABC} />);

    act(() => latest.api.duplicate('a'));

    expect(latest.api.sections).toHaveLength(4);
    expect(ids()[0]).toBe('a');
    expect(ids()[2]).toBe('b');
    expect(latest.api.selectedId).toBe(ids()[1]);
    expect(latest.api.selectedId).not.toBe('a');
  });

  it('removes through onBeforeDelete', async () => {
    const onBeforeDelete = vi
      .fn<(section: Section) => boolean | Promise<boolean>>()
      .mockReturnValueOnce(false)
      .mockResolvedValueOnce(true);

    render(<Editor initial={ABC} onBeforeDelete={onBeforeDelete} />);

    act(() => latest.api.remove('b'));
    expect(onBeforeDelete).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'b' }),
    );
    expect(ids()).toEqual(['a', 'b', 'c']);

    await act(async () => latest.api.remove('b'));
    expect(ids()).toEqual(['a', 'c']);
  });

  it('refuses every change while the document does not parse', () => {
    const onCode = vi.fn();

    render(<Editor initial={ABC} onCode={onCode} />);
    act(() => latest.api.select('a'));
    act(() => latest.setDocument(ABC.replace('</main>', '')));

    // The last version that parsed, read-only.
    expect(latest.api.readOnly).toBe(true);
    expect(ids()).toEqual(['a', 'b', 'c']);

    act(() => {
      latest.api.move('c', 'up');
      latest.api.moveTo('c', 0);
      latest.api.duplicate('a');
      latest.api.remove('b');
    });

    expect(onCode).not.toHaveBeenCalled();
    expect(ids()).toEqual(['a', 'b', 'c']);
  });
});

describe('onSelectionChange', () => {
  it('fires once per change, with null on clear and on removal', () => {
    const onSelectionChange = vi.fn();

    render(<Editor initial={ABC} onSelectionChange={onSelectionChange} />);

    expect(onSelectionChange).not.toHaveBeenCalled();

    act(() => latest.api.select('b'));
    act(() => latest.api.select('b'));
    expect(onSelectionChange).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: 'b' }),
    );

    act(() => latest.api.select(null));
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);

    act(() => latest.api.select('c'));
    act(() => latest.api.remove('c'));
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    expect(onSelectionChange).toHaveBeenCalledTimes(4);
  });

  // Such as an undo in the host, which replaces `value`.
  it('fires null when the selected section leaves through a new value', () => {
    const onSelectionChange = vi.fn();

    render(<Editor initial={ABC} onSelectionChange={onSelectionChange} />);

    act(() => latest.api.select('b'));
    act(() => latest.setDocument(documentOf(sectionsOf('a', 'c'))));

    expect(latest.api.selectedId).toBeNull();
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    expect(onSelectionChange).toHaveBeenCalledTimes(2);
  });

  it('does not fire again when only the callback changes', () => {
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = render(
      <Editor initial={ABC} onSelectionChange={first} />,
    );

    act(() => latest.api.select('a'));
    rerender(<Editor initial={ABC} onSelectionChange={second} />);

    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();

    act(() => latest.api.select('b'));
    expect(second).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: 'b' }),
    );
  });
});
