// @vitest-environment jsdom
import { act } from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  EditorSelection,
  EditorView,
  ViewUpdate,
} from '@uiw/react-codemirror';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PanelBinding } from '../panel-binding';
import Field from './field';

interface CoreEditorTestProps {
  onCreateEditor?: (view: EditorView) => void;
  onUpdate?: (update: ViewUpdate) => void;
}

const coreEditorMock = vi.hoisted(() => ({
  props: null as CoreEditorTestProps | null,
}));

vi.mock('~/components/editor/core', () => ({
  default: (props: CoreEditorTestProps) => {
    coreEditorMock.props = props;

    return <div data-testid="core-editor" tabIndex={0} />;
  },
}));

const binding = (override: Partial<PanelBinding> = {}): PanelBinding => ({
  id: 'el',
  label: 'Value',
  property: 'value',
  value: 'value',
  rawValue: 'value',
  onChange: () => {},
  ...override,
});

afterEach(cleanup);

describe('Field commit guards', () => {
  it('shows code-editor guidance instead of an unsafe value control', () => {
    render(
      <Field
        binding={binding({
          rawValue: '{ ...defaults, label: "A" }',
          canEditValue: false,
        })}
      />,
    );

    expect(screen.getByText(/not editable here/i)).not.toBeNull();
    expect(screen.getByText(/use the code editor/i)).not.toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('does not commit an untyped textarea value when the parsed value is unchanged', () => {
    const onChange = vi.fn();

    render(
      <Field
        binding={binding({
          value: null,
          rawValue: 'null',
          onChange,
        })}
      />,
    );

    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'null' } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not commit a selected option when its raw value is unchanged', () => {
    const onChange = vi.fn();

    render(
      <Field
        binding={binding({
          value: 42,
          rawValue: '42',
          options: [
            { label: 'Forty two', value: '42' },
            { label: 'Seven', value: '7' },
          ],
          onChange,
        })}
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '42' },
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Field JSX editor lifecycle', () => {
  it('restores selection and focus when CodeMirror recreates its view', () => {
    render(
      <Field
        binding={binding({
          property: 'children',
          type: 'jsx',
          value: '<div>Content</div>',
          rawValue: '<div>Content</div>',
        })}
      />,
    );

    const selection = { main: { head: 8 } } as EditorSelection;

    act(() => {
      coreEditorMock.props!.onUpdate?.({
        state: { selection },
      } as ViewUpdate);
    });
    fireEvent.focus(screen.getByTestId('core-editor'));

    const dispatch = vi.fn();
    const focus = vi.fn();

    act(() => {
      coreEditorMock.props!.onCreateEditor?.({
        dispatch,
        focus,
      } as unknown as EditorView);
    });

    expect(dispatch).toHaveBeenCalledWith({ selection });
    expect(focus).toHaveBeenCalledOnce();
  });

  it('does not restore focus after the user moves it outside the editor', () => {
    render(
      <>
        <Field
          binding={binding({
            property: 'children',
            type: 'jsx',
            value: '<div>Content</div>',
            rawValue: '<div>Content</div>',
          })}
        />
        <button type="button">Outside</button>
      </>,
    );

    const editor = screen.getByTestId('core-editor');
    const outside = screen.getByRole('button', { name: 'Outside' });

    fireEvent.focus(editor);
    fireEvent.blur(editor, { relatedTarget: outside });

    const focus = vi.fn();

    act(() => {
      coreEditorMock.props!.onCreateEditor?.({
        dispatch: vi.fn(),
        focus,
      } as unknown as EditorView);
    });

    expect(focus).not.toHaveBeenCalled();
  });
});

// The object-valued branch builds a binding per key through the same
// render-map resolution the items editor uses (#383), so a leaf's
// constraints apply to a nested key too.
describe('Field object values', () => {
  it('validates a nested key against its render-map leaf', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Field
        binding={binding({
          type: 'object',
          value: { size: 12 },
          rawValue: '{ size: 12 }',
          render: { size: { type: 'number', min: 0 } },
          onChange,
        })}
      />,
    );
    const input = container.querySelector<HTMLInputElement>(
      'input[type="number"]',
    )!;

    fireEvent.change(input, { target: { value: '-1' } });
    fireEvent.blur(input);

    expect(screen.getByText('Must be at least 0.')).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('labels a nested key with its leaf label, falling back to the key', () => {
    render(
      <Field
        binding={binding({
          type: 'object',
          value: { size: 12, gap: 4 },
          rawValue: '{ size: 12, gap: 4 }',
          render: { size: { type: 'number', label: 'Size' } },
        })}
      />,
    );

    expect(screen.getByText('Size')).not.toBeNull();
    expect(screen.getByText('gap')).not.toBeNull();
    expect(screen.queryByText('size')).toBeNull();
  });
});

// `step` (#629): the number input gets the same step, and a value off the
// step is rejected before it commits.
describe('Field number step', () => {
  it('passes step to the input and rejects a value off the step', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Field
        binding={binding({
          type: 'number',
          step: 0.5,
          value: 1,
          rawValue: '1',
          onChange,
        })}
      />,
    );
    const input = container.querySelector<HTMLInputElement>(
      'input[type="number"]',
    )!;

    expect(input.step).toBe('0.5');

    fireEvent.change(input, { target: { value: '1.2' } });
    fireEvent.blur(input);

    expect(screen.getByText('Must be in steps of 0.5.')).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(1.5);
  });
});

// `email` and `tel` (#629) use the browser's own input types.
describe('Field email and tel', () => {
  it.each([
    ['email', 'name@example.com'],
    ['tel', '+1 555 0100'],
  ] as const)('renders a %s input', (type, placeholder) => {
    const { container } = render(
      <Field binding={binding({ type, value: '', rawValue: '' })} />,
    );
    const input = container.querySelector<HTMLInputElement>(
      `input[type="${type}"]`,
    )!;

    expect(input.placeholder).toBe(placeholder);
  });

  it('rejects an invalid email before it commits', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Field
        binding={binding({ type: 'email', value: '', rawValue: '', onChange })}
      />,
    );
    const input = container.querySelector<HTMLInputElement>(
      'input[type="email"]',
    )!;

    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.blur(input);

    expect(screen.getByText('Must be a valid email address.')).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'a@b.co' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith('a@b.co');
  });
});

// `time` and `datetime` (#629) use ui-kit's TimePicker and DatePicker's
// `showTime`.
describe('Field time and datetime', () => {
  it('commits an HH:mm time from the time picker', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Field
        binding={binding({
          type: 'time',
          label: 'Opens at',
          value: '09:00',
          rawValue: '09:00',
          onChange,
        })}
      />,
    );
    const input =
      container.querySelector<HTMLInputElement>('input[type="time"]')!;

    expect(input.value).toBe('09:00');
    expect(input.getAttribute('aria-label')).toBe('Opens at');

    fireEvent.change(input, { target: { value: '14:30' } });

    expect(onChange).toHaveBeenCalledWith('14:30');
  });

  it.each([
    ['date', 'date', '2026-01-02', '2026-10-13'],
    ['datetime', 'datetime-local', '2026-01-02T03:04', '2026-10-13T14:30'],
  ] as const)(
    'reads and writes a %s value in its native format',
    (type, inputType, stored, written) => {
      const onChange = vi.fn();
      const { container } = render(
        <Field
          binding={binding({
            type,
            value: stored,
            rawValue: stored,
            onChange,
          })}
        />,
      );
      const input = container.querySelector<HTMLInputElement>(
        `input[type="${inputType}"]`,
      )!;

      expect(input.value).toBe(stored);

      fireEvent.change(input, { target: { value: written } });

      expect(onChange).toHaveBeenCalledWith(written);
    },
  );
});
