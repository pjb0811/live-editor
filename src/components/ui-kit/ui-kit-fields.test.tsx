// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DndEditOptionsContext,
  toastEditError,
} from '~/components/dnd/edit-options';
import type { PanelBinding } from '~/components/dnd/panel-binding';
import ElementFields from '~/components/dnd/panel/element-fields';
import Field from '~/components/dnd/panel/field';

import { uiKitFields } from './ui-kit-fields';

const datePickerMock = vi.hoisted(() => ({ enabled: false }));

vi.mock('@jbpark/ui-kit', async importOriginal => {
  const actual = await importOriginal<typeof import('@jbpark/ui-kit')>();

  return {
    ...actual,
    // When enabled, reports what it was given and picks 2026-10-13 14:30 on
    // click, so a test reads the field's own parsing and formatting, not the
    // calendar.
    DatePicker: (
      props: React.ComponentProps<typeof actual.DatePicker> & {
        value?: Date;
        showTime?: boolean;
        onChange?: (date: Date | undefined) => void;
      },
    ) =>
      datePickerMock.enabled ? (
        <button
          type="button"
          data-testid="date-picker"
          data-value={props.value ? props.value.toString() : ''}
          data-show-time={String(Boolean(props.showTime))}
          onClick={() => props.onChange?.(new Date(2026, 9, 13, 14, 30))}
        />
      ) : (
        <actual.DatePicker {...props} />
      ),
  };
});

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

const withUiKit = (children: React.ReactNode) => (
  <DndEditOptionsContext.Provider
    value={{ renderField: uiKitFields, reportError: toastEditError }}
  >
    {children}
  </DndEditOptionsContext.Provider>
);

afterEach(() => {
  cleanup();
  datePickerMock.enabled = false;
});

describe('uiKitFields', () => {
  it('leaves text fields to the built-in control', () => {
    render(withUiKit(<Field binding={binding()} />));

    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  });

  // The labels tie to the ui-kit controls as they do to the native ones
  // (#637).
  it('names the checkbox and the date picker by the label pointing at them', () => {
    render(
      withUiKit(
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
      ),
    );

    expect(screen.getByRole('checkbox', { name: /Visible/ })).not.toBeNull();

    const datePicker = screen.getByRole('button', { name: /Due/ });

    expect(screen.getByText('Due').closest('label')!.getAttribute('for')).toBe(
      datePicker.id,
    );
  });

  // A ui-kit select and rich text editor take no `id`, so they point at
  // their label with `aria-labelledby`.
  it('names a select and the rich text editor by aria-labelledby', () => {
    render(
      withUiKit(
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
      ),
    );

    const sizeLabel = screen.getByText('Size').closest('label')!;
    const select = screen.getByRole('combobox', { name: /Size/ });

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
      withUiKit(
        <Field
          binding={binding({
            label: 'Size',
            property: 'size',
            value: 'sm',
            rawValue: 'sm',
            options: [{ label: 'Small', value: 'sm' }],
          })}
        />,
      ),
    );

    const select = screen.getByRole('combobox', { name: 'Size' });

    expect(select.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('names the color picker by the field label', () => {
    render(
      withUiKit(
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
      ),
    );

    expect(screen.getByRole('button', { name: 'Accent' })).not.toBeNull();
  });

  it.each([
    ['date', '2026-10-13'],
    ['datetime', '2026-10-13T14:30'],
  ] as const)('reads and writes a %s value', (type, written) => {
    datePickerMock.enabled = true;

    const onChange = vi.fn();

    render(
      withUiKit(
        <Field
          binding={binding({
            type,
            value: '2026-01-02T03:04',
            rawValue: type === 'date' ? '2026-01-02' : '2026-01-02T03:04',
            onChange,
          })}
        />,
      ),
    );
    const picker = screen.getByTestId('date-picker');

    expect(picker.dataset.showTime).toBe(String(type === 'datetime'));
    expect(new Date(picker.dataset.value!).getTime()).toBe(
      type === 'date'
        ? new Date(2026, 0, 2).getTime()
        : new Date(2026, 0, 2, 3, 4).getTime(),
    );

    fireEvent.click(picker);

    expect(onChange).toHaveBeenCalledWith(written);
  });
});
