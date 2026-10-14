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

// The outline a panel field draws on its element (#514), measured through
// `useElementPosition` (#635).
describe('useInspectorState field outline', () => {
  // `DOMRect` keeps its fields on the prototype, so `toEqual` would call any
  // two rects equal. Compare the numbers.
  const boxOf = (rect: DOMRect | null) =>
    rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height };

  const nextFrame = () =>
    act(() => new Promise(resolve => requestAnimationFrame(() => resolve(0))));

  const setupOutline = () => {
    const section = document.createElement('section');
    const element = document.createElement('p');

    element.setAttribute('data-id', 'title');
    section.append(element);
    document.body.append(section);

    let box = new DOMRect(10, 20, 100, 30);
    element.getBoundingClientRect = () => box;

    // One registry for every render, as `useDndKeyboard` keeps it.
    const sectionNodes = {
      get: (id: string) => (id === 's1' ? section : undefined),
      register: () => () => {},
    };
    const selectOnly = vi.fn();
    const hook = renderHook(() =>
      useInspectorState({ selectedId: 's1', selectOnly, sectionNodes }),
    );

    return {
      ...hook,
      moveTo: (next: DOMRect) => {
        box = next;
      },
    };
  };

  it('outlines the element a field points at', async () => {
    const { result } = setupOutline();

    act(() => result.current.inspector.highlight('title'));
    await nextFrame();

    expect(boxOf(result.current.highlightRect)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 30,
    });
  });

  it('follows the element when the canvas scrolls', async () => {
    const { result, moveTo } = setupOutline();

    act(() => result.current.inspector.highlight('title'));
    await nextFrame();

    moveTo(new DOMRect(10, 5, 100, 30));
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await nextFrame();

    expect(boxOf(result.current.highlightRect)).toEqual({
      x: 10,
      y: 5,
      width: 100,
      height: 30,
    });
  });

  // An edit moves the element without a scroll or resize; the frame after
  // the re-render measures it again.
  it('follows the element after a re-render', async () => {
    const { result, rerender, moveTo } = setupOutline();

    act(() => result.current.inspector.highlight('title'));
    await nextFrame();

    moveTo(new DOMRect(10, 20, 100, 60));
    rerender();
    await nextFrame();

    expect(boxOf(result.current.highlightRect)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 60,
    });
  });

  it('clears the outline at once when the field stops pointing', async () => {
    const { result } = setupOutline();

    act(() => result.current.inspector.highlight('title'));
    await nextFrame();
    act(() => result.current.inspector.highlight(null));

    expect(result.current.highlightRect).toBeNull();
  });

  it('draws nothing for an id the section does not render', async () => {
    const { result } = setupOutline();

    act(() => result.current.inspector.highlight('missing'));
    await nextFrame();

    expect(result.current.highlightRect).toBeNull();
  });
});
