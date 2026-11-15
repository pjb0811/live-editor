// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DndEditOptionsContext } from '../edit-options';
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

// The `meta` keys the built-in panel reads (#753).
describe('Panel meta keys', () => {
  const field = (override: Partial<PanelBinding>): PanelBinding => ({
    id: 'a',
    label: 'Text',
    property: 'title',
    value: 'x',
    rawValue: 'x',
    element: { tagName: 'a', text: '' },
    onChange: vi.fn(),
    ...override,
  });

  it('shows a description under the label and describes the control with it', () => {
    renderPanel([
      field({
        label: 'URL',
        property: 'href',
        type: 'url',
        protocols: ['https:'],
        meta: { description: 'Opens in the same tab.' },
      }),
    ]);

    const description = screen.getByText('Opens in the same tab.');
    const input = screen.getByRole('textbox');

    expect(input.getAttribute('aria-describedby')).toBe(description.id);

    fireEvent.change(input, { target: { value: 'http://a.b' } });
    fireEvent.blur(input);

    const error = screen.getByRole('alert');

    expect(input.getAttribute('aria-describedby')).toBe(
      `${description.id} ${error.id}`,
    );
  });

  // The docs' example.
  const linkFields = (mode: string, present = true) => [
    field({
      label: 'Link',
      property: 'mode',
      value: mode,
      rawValue: mode,
      options: [
        { label: 'None', value: 'none' },
        { label: 'URL', value: 'url' },
      ],
      ...(!present && { present: false }),
    }),
    field({
      label: 'URL',
      property: 'href',
      type: 'url',
      meta: {
        visible: { property: 'mode', in: ['url'], default: 'none' },
      },
    }),
  ];

  const labels = () =>
    [...document.querySelectorAll('label')].map(label =>
      label.textContent?.replace(/\(.*\)/, ''),
    );

  it('shows a field only while its visible rule matches', () => {
    const { rerender } = renderPanel(linkFields('none'));

    expect(labels()).toEqual(['Link']);

    rerender(<Panel item={item} bindings={linkFields('url')} />);
    expect(labels()).toEqual(['Link', 'URL']);

    // `default` while the attribute is absent.
    rerender(<Panel item={item} bindings={linkFields('url', false)} />);
    expect(labels()).toEqual(['Link']);
  });

  it('gives an element whose fields are all hidden no card', () => {
    renderPanel([
      binding('t1', 'h2', 'One'),
      { ...binding('t2', 'h2', 'Two'), meta: { visible: false } },
    ]);

    expect(screen.getAllByRole('group')).toHaveLength(1);
    // A single card left, so no element headers.
    expect(screen.queryByText('Two')).toBeNull();
  });

  it('passes renderField the visible fields, inside their group', () => {
    const renderField = vi.fn(({ binding }: { binding: PanelBinding }) => (
      <span data-testid={`custom-${binding.property}`} />
    ));
    const { container } = render(
      <DndEditOptionsContext.Provider
        value={{ reportError: vi.fn(), renderField }}
      >
        <Panel
          item={item}
          bindings={[
            field({ label: 'B', property: 'b', meta: { group: 'Link' } }),
            field({ label: 'H', property: 'h', meta: { visible: false } }),
          ]}
        />
      </DndEditOptionsContext.Provider>,
    );

    expect(
      renderField.mock.calls.map(([props]) => props.binding.property),
    ).toEqual(['b']);
    expect(
      container.querySelector('fieldset [data-testid="custom-b"]'),
    ).not.toBeNull();
  });

  it('boxes the fields of a group where its first field was', () => {
    const { container } = renderPanel([
      field({ label: 'A', property: 'a' }),
      field({ label: 'B', property: 'b', meta: { group: 'Link' } }),
      field({ label: 'C', property: 'c' }),
      field({ label: 'D', property: 'd', meta: { group: 'Link' } }),
      field({ id: 'b', label: 'E', property: 'e', meta: { group: 'Link' } }),
    ]);

    const fieldsets = [...container.querySelectorAll('fieldset')];

    // One per element, even with the same name.
    expect(fieldsets).toHaveLength(2);
    expect(fieldsets[0]!.querySelector('legend')!.textContent).toBe('Link');

    const order = [...container.querySelectorAll('label, legend')].map(node =>
      node.textContent?.replace(/\(.*\)/, ''),
    );

    expect(order).toEqual(['A', 'Link', 'B', 'D', 'C', 'Link', 'E']);
    expect(
      [...fieldsets[0]!.querySelectorAll('label')].map(label =>
        label.textContent?.replace(/\(.*\)/, ''),
      ),
    ).toEqual(['B', 'D']);
  });
});
