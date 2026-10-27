// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { PanelBinding } from '../panel-binding';
import ElementFields from './element-fields';
import Field from './field';

const binding = (override: Partial<PanelBinding> = {}): PanelBinding => ({
  id: 'el',
  label: 'Title',
  property: 'innerText',
  type: 'string',
  value: 'Hello',
  rawValue: 'Hello',
  onChange: () => {},
  ...override,
});

afterEach(cleanup);

// The panel's labels name their controls, and a failed validation is tied to
// the control (#637).
describe('panel field labels', () => {
  it('names each control by its label, which points at it', () => {
    render(
      <ElementFields
        bindings={[
          binding(),
          binding({
            label: 'Count',
            property: 'data-count',
            type: 'number',
            value: 3,
            rawValue: '3',
          }),
        ]}
      />,
    );

    const title = screen.getByLabelText(/Title/);
    const count = screen.getByLabelText(/Count/);

    expect(title.tagName).toBe('TEXTAREA');
    expect(count.getAttribute('type')).toBe('number');

    // The label points at the control, which is what makes a click on it
    // focus the control. jsdom doesn't move focus on its own.
    expect(
      screen.getByText('Count').closest('label')!.getAttribute('for'),
    ).toBe(count.id);
  });

  it('ties a validation error to the control and clears it once valid', () => {
    render(
      <ElementFields
        bindings={[
          binding({ pattern: '^[a-z]+$', patternMessage: 'a-z only' }),
        ]}
      />,
    );
    const input = screen.getByLabelText(/Title/);

    fireEvent.change(input, { target: { value: 'ABC' } });
    fireEvent.blur(input);

    const error = screen.getByRole('alert');

    expect(error.textContent).toBe('a-z only');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);

    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
  });

  it('labels each key of an object value', () => {
    render(
      <ElementFields
        bindings={[
          binding({
            label: 'Style',
            property: 'style',
            type: 'object',
            value: { gap: 4 },
            rawValue: '{ gap: 4 }',
            render: { gap: { type: 'number', label: 'Gap' } },
          }),
        ]}
      />,
    );

    expect(screen.getByLabelText('Gap').getAttribute('type')).toBe('number');
  });

  it('gives each field its own ids when labels repeat', () => {
    render(
      <ElementFields
        bindings={[
          binding({ property: 'title' }),
          binding({ property: 'subtitle' }),
        ]}
      />,
    );
    const [first, second] = screen.getAllByLabelText(/Title/);

    expect(first!.id).not.toBe(second!.id);
  });

  it('names the checkbox and the date picker by the label pointing at them', () => {
    render(
      <ElementFields
        bindings={[
          binding({
            label: 'Visible',
            property: 'visible',
            type: 'boolean',
            value: true,
            rawValue: 'true',
          }),
          binding({
            label: 'Due',
            property: 'due',
            type: 'date',
            value: '2026-01-02',
            rawValue: '2026-01-02',
          }),
        ]}
      />,
    );

    expect(screen.getByRole('checkbox', { name: /Visible/ })).not.toBeNull();

    const datePicker = screen.getByRole('button', { name: /Due/ });

    expect(screen.getByText('Due').closest('label')!.getAttribute('for')).toBe(
      datePicker.id,
    );
  });

  // A select and the rich text editor take no `id`, so they point at their
  // label with `aria-labelledby`, and the label gets no `for`.
  it('names a select and the rich text editor by aria-labelledby', () => {
    render(
      <ElementFields
        bindings={[
          binding({
            label: 'Size',
            property: 'size',
            value: 'sm',
            rawValue: 'sm',
            options: [
              { label: 'Small', value: 'sm' },
              { label: 'Large', value: 'lg' },
            ],
          }),
          binding({
            label: 'Body',
            property: 'body',
            type: 'richtext',
            value: '<p>Hi</p>',
            rawValue: '<p>Hi</p>',
          }),
        ]}
      />,
    );

    const sizeLabel = screen.getByText('Size').closest('label')!;
    const select = screen.getByRole('combobox', { name: /Size/ });

    expect(sizeLabel.hasAttribute('for')).toBe(false);
    expect(select.getAttribute('aria-labelledby')).toBe(sizeLabel.id);
    expect(select.hasAttribute('aria-label')).toBe(false);

    const bodyLabel = screen.getByText('Body').closest('label')!;

    expect(
      screen
        .getByRole('textbox', { name: /Body/ })
        .getAttribute('aria-labelledby'),
    ).toBe(bodyLabel.id);
  });

  it('names a select itself outside a labelled field', () => {
    render(
      <Field
        binding={binding({
          label: 'Size',
          property: 'size',
          value: 'sm',
          rawValue: 'sm',
          options: [{ label: 'Small', value: 'sm' }],
        })}
      />,
    );

    const select = screen.getByRole('combobox', { name: 'Size' });

    expect(select.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('names the color picker by the field label', () => {
    render(
      <ElementFields
        bindings={[
          binding({
            label: 'Accent',
            property: 'color',
            type: 'color',
            value: '#ff0000',
            rawValue: '#ff0000',
          }),
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Accent' })).not.toBeNull();
  });

  // `Live.Dnd.Field` in a custom panel's own markup has no `LabeledField`
  // around it, so the control names itself.
  it('names the control itself outside a labelled field', () => {
    render(<Field binding={binding()} />);

    expect(screen.getByRole('textbox').getAttribute('aria-label')).toBe(
      'Title',
    );
  });

  it('does not repeat the name inside a labelled field', () => {
    render(<ElementFields bindings={[binding()]} />);

    expect(screen.getByRole('textbox').hasAttribute('aria-label')).toBe(false);
  });
});
