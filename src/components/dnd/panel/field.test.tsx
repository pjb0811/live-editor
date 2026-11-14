// @vitest-environment jsdom
import { act } from 'react';

import { parseExpression } from '@babel/parser';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type {
  EditorSelection,
  EditorView,
  ViewUpdate,
} from '@uiw/react-codemirror';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { update } from '~/utils/ast/update';
import { evaluateLiteral } from '~/utils/ast/value';

import { type DndEditError, DndEditOptionsContext } from '../edit-options';
import type { PanelBinding } from '../panel-binding';
import Field from './field';

interface CoreEditorTestProps {
  raw?: boolean;
  fragment?: boolean;
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

  // Typing into the editor, as CodeMirror reports it.
  const typeSource = (text: string) => {
    act(() => {
      coreEditorMock.props!.onUpdate?.({
        docChanged: true,
        state: { selection: {}, doc: { toString: () => text } },
      } as unknown as ViewUpdate);
    });
  };

  const renderSourceField = (onChange: (value: unknown) => void) =>
    render(
      <>
        <Field
          binding={binding({
            property: 'innerHTML',
            value: '<b>old</b>',
            rawValue: '<b>old</b>',
            onChange,
          })}
        />
        <button type="button">Outside</button>
      </>,
    );

  it('commits the edited source when focus leaves the editor (#711)', async () => {
    const onChange = vi.fn();

    renderSourceField(onChange);
    screen.getByTestId('core-editor').focus();
    typeSource('<i>new</i>');
    screen.getByRole('button', { name: 'Outside' }).focus();
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('<i>new</i>');
  });

  it('does not commit when focus leaves without an edit', async () => {
    const onChange = vi.fn();

    renderSourceField(onChange);
    screen.getByTestId('core-editor').focus();
    screen.getByRole('button', { name: 'Outside' }).focus();
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not commit when focus comes back to the editor in the same task', async () => {
    const onChange = vi.fn();

    renderSourceField(onChange);

    const editor = screen.getByTestId('core-editor');

    editor.focus();
    typeSource('<i>new</i>');
    // A recreated view blurs and takes focus back (#359).
    editor.blur();
    editor.focus();
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Field function bindings (#741)', () => {
  const options = [
    { label: 'Open', value: 'actions.open' },
    { label: 'Track', value: 'actions.track' },
  ];

  it('edits the source without Prettier, which would format it as JSX', () => {
    render(
      <Field
        binding={binding({
          type: 'function',
          value: '() => go()',
          rawValue: '() => go()',
        })}
      />,
    );

    expect(screen.getByTestId('core-editor')).not.toBeNull();
    expect(coreEditorMock.props).toMatchObject({ raw: true, fragment: false });
  });

  it('formats a jsx binding as before', () => {
    render(<Field binding={binding({ type: 'jsx', rawValue: '<b />' })} />);

    expect(coreEditorMock.props).toMatchObject({ raw: false, fragment: true });
  });

  it('offers an empty choice only while no handler is set', () => {
    const { rerender } = render(
      <Field
        binding={binding({
          type: 'function',
          options,
          value: '',
          rawValue: '',
        })}
      />,
    );

    expect(
      screen.getAllByRole('option').map(option => option.textContent),
    ).toEqual(['None', 'Open', 'Track']);

    rerender(
      <Field
        binding={binding({
          type: 'function',
          options,
          value: 'actions.open',
          rawValue: 'actions.open',
        })}
      />,
    );

    expect(
      screen.getAllByRole('option').map(option => option.textContent),
    ).toEqual(['Open', 'Track']);
  });

  it('commits the chosen option as its source', () => {
    const onChange = vi.fn();

    render(
      <Field
        binding={binding({
          type: 'function',
          options,
          value: 'actions.open',
          rawValue: 'actions.open',
          onChange,
        })}
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'actions.track' },
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith('actions.track');
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

  // An edit to one key keeps the rest of the object as written (#722).
  describe('editing one key', () => {
    const style = (rawValue: string, onChange: (next: unknown) => void) => (
      <Field
        binding={binding({
          property: 'style',
          type: 'object',
          value: evaluateLiteral(parseExpression(rawValue)),
          rawValue,
          onChange,
        })}
      />
    );

    const commitText = (container: HTMLElement, from: string, to: string) => {
      const field = [
        ...container.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
          'textarea, input',
        ),
      ].find(control => control.value === from)!;

      fireEvent.change(field, { target: { value: to } });
      fireEvent.blur(field);
    };

    // The reproduction from #722, through the color control.
    it('replaces only that value in the source', async () => {
      const onChange = vi.fn();
      const { container } = render(
        style("{ color: '#ff0000', fontSize: 12 }", onChange),
      );

      fireEvent.change(container.querySelector('input[type="color"]')!, {
        target: { value: '#0000ff' },
      });

      await waitFor(() =>
        expect(onChange).toHaveBeenCalledExactlyOnceWith(
          "{ color: '#0000ff', fontSize: 12 }",
        ),
      );

      // What the panel then writes into the element.
      const src = `<Foo data-id="a" data-binding={[{label:'S',property:'style'}]} style={{ color: '#ff0000', fontSize: 12 }} />`;

      expect(
        update(src, 'a', 'S', onChange.mock.calls[0]![0], 'style').code,
      ).toBe(
        `<Foo data-id="a" data-binding={[{label:'S',property:'style'}]} style={{ color: '#0000ff', fontSize: 12 }} />`,
      );
    });

    it('keeps quoted keys and a number value as written', () => {
      const onChange = vi.fn();
      const { container } = render(
        style('{ "font-size": 12, title: "old" }', onChange),
      );

      commitText(container, 'old', 'new');

      expect(onChange).toHaveBeenCalledExactlyOnceWith(
        '{ "font-size": 12, title: "new" }',
      );
    });

    // `data` defaults to the array editor; `type: 'object'` opts out (#746).
    it('edits one key of an object-typed data binding', () => {
      const onChange = vi.fn();
      const rawValue = "{ title: 'old', size: 2 }";
      const { container } = render(
        <Field
          binding={binding({
            property: 'data',
            type: 'object',
            value: evaluateLiteral(parseExpression(rawValue)),
            rawValue,
            onChange,
          })}
        />,
      );

      commitText(container, 'old', 'new');

      expect(onChange).toHaveBeenCalledExactlyOnceWith(
        "{ title: 'new', size: 2 }",
      );
    });

    it('edits a key of a nested object in place', () => {
      const onChange = vi.fn();
      const { container } = render(
        style("{ title: 'old', box: { pad: 'a', m: 'x' } }", onChange),
      );

      commitText(container, 'a', 'b');

      expect(onChange).toHaveBeenCalledExactlyOnceWith(
        "{ title: 'old', box: { pad: 'b', m: 'x' } }",
      );
    });
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

// `time` and `datetime` (#629) use the native `<input type="time">` and
// `<input type="datetime-local">`.
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

// `type: 'image'` (#752): a URL input, a thumbnail of the committed value,
// and a file picker that goes through `onUpload`.
describe('Field image', () => {
  const image = (override: Partial<PanelBinding> = {}) =>
    binding({
      label: 'Image',
      property: 'src',
      type: 'image',
      value: '/a.png',
      rawValue: '/a.png',
      ...override,
    });

  const deferred = () => {
    let resolve!: (url: string) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<string>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve, reject };
  };

  const withUpload = (
    ui: React.ReactElement,
    onUpload?: (file: File) => Promise<string>,
    reportError: (error: DndEditError) => void = vi.fn(),
  ) => (
    <DndEditOptionsContext.Provider value={{ reportError, onUpload }}>
      {ui}
    </DndEditOptionsContext.Provider>
  );

  const file = new File(['x'], 'photo.png', { type: 'image/png' });

  const chooseFile = (container: HTMLElement) =>
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

  const chooseButton = () => screen.getByRole('button');

  it('shows the committed value, not the typed text, and hides it on error', () => {
    const { container } = render(<Field binding={image()} />);
    const thumbnail = () => container.querySelector('img');
    const input = container.querySelector<HTMLInputElement>('input')!;

    expect(thumbnail()!.getAttribute('src')).toBe('/a.png');
    expect(thumbnail()!.getAttribute('alt')).toBe('');

    fireEvent.change(input, { target: { value: '/half' } });
    expect(thumbnail()!.getAttribute('src')).toBe('/a.png');

    fireEvent.error(thumbnail()!);
    expect(thumbnail()).toBeNull();
  });

  it('shows no thumbnail for an empty value', () => {
    const { container } = render(
      <Field binding={image({ value: '', rawValue: '' })} />,
    );

    expect(container.querySelector('img')).toBeNull();
  });

  it('commits a relative path typed into the input', () => {
    const onChange = vi.fn();
    const { container } = render(<Field binding={image({ onChange })} />);
    const input = container.querySelector<HTMLInputElement>('input')!;

    fireEvent.change(input, { target: { value: ' ./b.png ' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledExactlyOnceWith('./b.png');
  });

  it('offers no file picker without onUpload', () => {
    const { container } = render(withUpload(<Field binding={image()} />));

    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('uploads the chosen file and commits the URL', async () => {
    const onChange = vi.fn();
    const upload = deferred();
    const onUpload = vi.fn(() => upload.promise);
    const { container } = render(
      withUpload(<Field binding={image({ onChange })} />, onUpload),
    );

    expect(
      container.querySelector('input[type="file"]')!.getAttribute('accept'),
    ).toBe('image/*');

    chooseFile(container);

    expect(onUpload).toHaveBeenCalledExactlyOnceWith(file, {
      binding: { id: 'el', label: 'Image', property: 'src', type: 'image' },
    });
    expect(chooseButton().getAttribute('aria-busy')).toBe('true');
    expect((chooseButton() as HTMLButtonElement).disabled).toBe(true);

    await act(async () => upload.resolve('https://cdn/x.png'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('https://cdn/x.png');
    expect(chooseButton().getAttribute('aria-busy')).toBeNull();
    expect((chooseButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('reports a rejected upload and keeps the value', async () => {
    const onChange = vi.fn();
    const reportError = vi.fn();
    const upload = deferred();
    const error = new Error('Too large');
    const { container } = render(
      withUpload(
        <Field binding={image({ onChange })} />,
        () => upload.promise,
        reportError,
      ),
    );

    chooseFile(container);
    await act(async () => upload.reject(error));

    expect(onChange).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledExactlyOnceWith({
      type: 'upload',
      id: 'el',
      label: 'Image',
      property: 'src',
      error,
      title: 'Failed to upload an image for "Image"',
      description: 'Too large',
    });
  });

  it('validates the uploaded URL like a typed one', async () => {
    const onChange = vi.fn();
    const { container } = render(
      withUpload(
        <Field binding={image({ onChange, protocols: ['https:'] })} />,
        async () => 'http://cdn/x.png',
      ),
    );

    chooseFile(container);
    await act(async () => {});

    expect(onChange).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Must use https:.');
  });

  it('drops a result that arrives after the binding changed', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const upload = deferred();
    const onUpload = () => upload.promise;
    const { container, rerender } = render(
      withUpload(<Field binding={image({ onChange: first })} />, onUpload),
    );

    chooseFile(container);
    rerender(
      withUpload(
        <Field binding={image({ id: 'other', onChange: second })} />,
        onUpload,
      ),
    );
    await act(async () => upload.resolve('https://cdn/x.png'));

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it('keeps only the latest of two uploads', async () => {
    const onChange = vi.fn();
    const older = deferred();
    const newer = deferred();
    const onUpload = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    const { container } = render(
      withUpload(<Field binding={image({ onChange })} />, onUpload),
    );

    chooseFile(container);
    chooseFile(container);
    await act(async () => newer.resolve('https://cdn/new.png'));
    await act(async () => older.resolve('https://cdn/old.png'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('https://cdn/new.png');
  });

  it('drops a result that arrives after the field unmounted', async () => {
    const onChange = vi.fn();
    const reportError = vi.fn();
    const upload = deferred();
    const { container, unmount } = render(
      withUpload(
        <Field binding={image({ onChange })} />,
        () => upload.promise,
        reportError,
      ),
    );

    chooseFile(container);
    unmount();
    await act(async () => upload.reject(new Error('late')));

    expect(onChange).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
  });
});
