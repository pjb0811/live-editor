// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PanelBinding } from '../dnd';
import FieldGroup from './field-group';

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

// `update()`/`bulkUpdate()` address a binding by `property`, not by label
// (58e2171). The panel's React keys have to agree, otherwise two bindings
// sharing a label collide: React warns, and local control state can be
// carried across to the wrong field (#318).
describe('FieldGroup keys bindings by property, not label', () => {
  it('renders both bindings when two share one label, without a key warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <FieldGroup
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
      <FieldGroup
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
