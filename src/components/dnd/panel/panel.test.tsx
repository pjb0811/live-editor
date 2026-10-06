// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type DndInspector, DndInspectorContext } from '../inspector';
import type { PanelBinding } from '../panel-binding';
import Panel from './panel';

const binding = (
  id: string,
  tagName: string,
  text: string,
  label = 'Heading',
): PanelBinding => ({
  id,
  label,
  property: 'innerText',
  value: text,
  rawValue: text,
  element: { tagName, text },
  onChange: vi.fn(),
});

const item = { id: 's1', name: 'Cards', code: '' };

afterEach(cleanup);

const renderPanel = (bindings: PanelBinding[]) => {
  const inspector: DndInspector = {
    active: false,
    activate: vi.fn(),
    deactivate: vi.fn(),
    toggle: vi.fn(),
    picked: null,
    highlight: vi.fn(),
  };

  const utils = render(
    <DndInspectorContext.Provider value={inspector}>
      <Panel item={item} bindings={bindings} />
    </DndInspectorContext.Provider>,
  );

  return {
    ...utils,
    highlight: inspector.highlight as ReturnType<typeof vi.fn>,
  };
};

// Fields that share a label are told apart by the element they edit (#514).
describe('Panel element groups', () => {
  const shared = [
    binding('t1', 'ui.Typography.Title', 'Fast setup'),
    binding('t2', 'ui.Typography.Title', 'Live preview'),
  ];

  it('heads each element with its tag and text once there are several', () => {
    renderPanel(shared);

    const groups = screen.getAllByRole('group');

    expect(groups.map(group => group.getAttribute('aria-label'))).toEqual([
      'ui.Typography.Title "Fast setup"',
      'ui.Typography.Title "Live preview"',
    ]);
    expect(groups[1]!.textContent).toContain('Live preview');
    expect(screen.getAllByText('ui.Typography.Title')).toHaveLength(2);
  });

  it('shows no header for a single element', () => {
    renderPanel([binding('t1', 'h1', 'Welcome')]);

    expect(screen.getByRole('group', { name: 'h1 "Welcome"' })).toBeTruthy();
    expect(screen.queryByText('h1')).toBeNull();
  });

  it('outlines the element of the field under the pointer or focus', () => {
    const { highlight } = renderPanel(shared);
    const [first, second] = screen.getAllByRole('group');
    const field = first!.querySelector<HTMLElement>('textarea, input')!;

    act(() => field.focus());
    expect(highlight).toHaveBeenLastCalledWith('t1');

    // The pointer wins over focus while it's over another element.
    act(() => {
      fireEvent.pointerOver(second!);
    });
    expect(highlight).toHaveBeenLastCalledWith('t2');

    act(() => {
      fireEvent.pointerLeave(first!.parentElement!);
    });
    expect(highlight).toHaveBeenLastCalledWith('t1');

    act(() => {
      fireEvent.focusOut(field, { relatedTarget: document.body });
    });
    expect(highlight).toHaveBeenLastCalledWith(null);
  });
});
