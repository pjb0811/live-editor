// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PanelBinding } from '../panel-binding';
import ElementFields from './element-fields';
import { ElementSelectionContext } from './element-selection';

const binding = (
  property: string,
  value: string,
  onChange: (next: unknown) => void = () => {},
): PanelBinding => ({
  id: 'el',
  // Deliberately the same label on both bindings: a label is free text from
  // the consumer's `data-binding` and carries no uniqueness guarantee.
  label: 'Text',
  property,
  type: 'string',
  value,
  rawValue: value,
  onChange,
});

afterEach(cleanup);

// `update()`/`updateAll()` address a binding by `property`, not by label
// (58e2171). The panel's React keys have to agree, otherwise two bindings
// sharing a label collide: React warns, and local control state can be
// carried across to the wrong field (#318).
describe('ElementFields keys bindings by property, not label', () => {
  it('renders both bindings when two share one label, without a key warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ElementFields
        bindings={[binding('heading', 'red'), binding('subheading', 'blue')]}
      />,
    );

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(inputs.map(input => input.value)).toEqual(['red', 'blue']);

    const warnings = error.mock.calls
      .map(call => String(call[0]))
      .filter(message => /same key|unique "key"/i.test(message));
    expect(warnings).toEqual([]);

    error.mockRestore();
  });

  it('commits an edit to the binding that was actually edited', () => {
    const onColor = vi.fn();
    const onBackground = vi.fn();

    render(
      <ElementFields
        bindings={[
          binding('heading', 'red', onColor),
          binding('subheading', 'blue', onBackground),
        ]}
      />,
    );

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.change(inputs[1]!, { target: { value: 'green' } });
    fireEvent.blur(inputs[1]!);

    expect(onBackground).toHaveBeenCalledWith('green');
    expect(onColor).not.toHaveBeenCalled();
  });
});

// Selection reaches the cards as data, so several can be marked at once
// (#643).
describe('ElementFields selection', () => {
  const card = (id: string) =>
    document.querySelector<HTMLElement>(`[data-node-id="${id}"]`)!;

  const renderCards = (ids: string[]) =>
    render(
      <ElementSelectionContext.Provider value={{ ids: new Set(ids) }}>
        <ElementFields id="a" bindings={[binding('heading', 'A')]} />
        <ElementFields id="b" bindings={[binding('heading', 'B')]} />
        <ElementFields id="c" bindings={[binding('heading', 'C')]} />
      </ElementSelectionContext.Provider>,
    );

  it('marks every card the selection holds', () => {
    renderCards(['a', 'c']);

    expect(card('a').hasAttribute('data-picked')).toBe(true);
    expect(card('b').hasAttribute('data-picked')).toBe(false);
    expect(card('c').hasAttribute('data-picked')).toBe(true);
  });

  it('follows the selection when it changes', () => {
    const { rerender } = renderCards(['a']);

    rerender(
      <ElementSelectionContext.Provider value={{ ids: new Set(['b']) }}>
        <ElementFields id="a" bindings={[binding('heading', 'A')]} />
        <ElementFields id="b" bindings={[binding('heading', 'B')]} />
        <ElementFields id="c" bindings={[binding('heading', 'C')]} />
      </ElementSelectionContext.Provider>,
    );

    expect(card('a').hasAttribute('data-picked')).toBe(false);
    expect(card('b').hasAttribute('data-picked')).toBe(true);
  });

  it('scrolls a newly marked card into view', () => {
    const original = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();

    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      renderCards(['b']);

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
      expect(scrollIntoView.mock.contexts[0]).toBe(card('b'));
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('marks nothing without a selection, or for a card without an id', () => {
    render(
      <ElementSelectionContext.Provider value={{ ids: new Set(['x']) }}>
        <ElementFields bindings={[binding('heading', 'A')]} />
      </ElementSelectionContext.Provider>,
    );

    expect(document.querySelector('[data-picked]')).toBeNull();
    expect(document.querySelector('[data-node-id]')).toBeNull();
  });
});
