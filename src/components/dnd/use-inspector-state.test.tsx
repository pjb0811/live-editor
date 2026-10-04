// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useInspectorState } from './use-inspector-state';

// What hit testing reports at any point: the overlay on top, then `element`.
const stubHitTest = (overlay: Element, element: Element) => {
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: () => [overlay, element],
  });
};

afterEach(() => {
  delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
  document.body.innerHTML = '';
});

const setup = (selectedId: string | null = 's1') => {
  const selectOnly = vi.fn();
  const onNodePick = vi.fn();
  const sectionNodes = { get: () => undefined, register: () => () => {} };
  const hook = renderHook(
    ({ selected }) =>
      useInspectorState({
        selectedId: selected,
        selectOnly,
        sectionNodes,
        onNodePick,
      }),
    { initialProps: { selected: selectedId } },
  );

  return { ...hook, selectOnly, onNodePick };
};

describe('useInspectorState', () => {
  it('turns the picker on and off, and Escape turns it off', () => {
    const { result } = setup();

    act(() => result.current.inspector.toggle());
    expect(result.current.inspector.active).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.inspector.active).toBe(false);
  });

  it("picks an element's data-id, selects its section and stops picking", () => {
    const { result, selectOnly, onNodePick } = setup();
    const section = document.createElement('div');
    const overlay = document.createElement('div');
    const title = document.createElement('h2');

    title.setAttribute('data-id', 'title');
    section.append(title, overlay);
    document.body.append(section);
    stubHitTest(overlay, title);

    act(() => result.current.inspector.activate());
    act(() => result.current.onInspectPick('s2', section, overlay, 1, 1));

    expect(selectOnly).toHaveBeenCalledWith('s2');
    expect(onNodePick).toHaveBeenCalledWith({ id: 'title', sectionId: 's2' });
    expect(result.current.inspector.active).toBe(false);
  });

  it('ignores a pick that lands on no element with an id', () => {
    const { result, onNodePick } = setup();
    const section = document.createElement('div');
    const overlay = document.createElement('div');

    section.append(overlay);
    document.body.append(section);
    stubHitTest(overlay, section);

    act(() => result.current.inspector.activate());
    act(() => result.current.onInspectPick('s1', section, overlay, 1, 1));

    expect(onNodePick).not.toHaveBeenCalled();
    expect(result.current.inspector.active).toBe(true);
  });

  it('clears the pick when another section is selected', () => {
    const { result, rerender } = setup('s2');
    const section = document.createElement('div');
    const overlay = document.createElement('div');
    const title = document.createElement('h2');

    title.setAttribute('data-id', 'title');
    section.append(title, overlay);
    document.body.append(section);
    stubHitTest(overlay, title);

    act(() => result.current.onInspectPick('s2', section, overlay, 1, 1));
    expect(result.current.inspector.picked).toEqual({
      id: 'title',
      sectionId: 's2',
    });

    rerender({ selected: 's3' });
    expect(result.current.inspector.picked).toBeNull();
  });
});
