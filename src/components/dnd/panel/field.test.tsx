// @vitest-environment jsdom
import { act } from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  EditorSelection,
  EditorView,
  ViewUpdate,
} from '@uiw/react-codemirror';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PanelBinding } from '../dnd';
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

vi.mock('@jbpark/ui-kit', async importOriginal => {
  const actual = await importOriginal<typeof import('@jbpark/ui-kit')>();

  return {
    ...actual,
    Select: ({
      options,
      onChange,
      value,
    }: {
      options?: { label: string; value: string }[];
      onChange?: (value: string) => void;
      value?: string;
    }) => (
      <select value={value} onChange={event => onChange?.(event.target.value)}>
        {options?.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

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
