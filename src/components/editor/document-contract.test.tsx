// @vitest-environment jsdom
import { useState } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ContextProvider from '~/components/context/context';
import { usePreview } from '~/components/context/states';

import Editor, { type Props } from './editor';

// The document contract of #341, from the Editor's side: who owns the
// document, who hears about an edit, and when the provider's `code` (what a
// `Live.Preview` renders) catches up.

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const DEBOUNCE = 100;

// A plain textarea stands in for CodeMirror; the contract lives in Editor.
const TextEditor = (props: Partial<Props>) => (
  <Editor
    debounce={DEBOUNCE}
    renderEditor={({ value, onChange }) => (
      <textarea
        data-testid="editor"
        value={value}
        onChange={event => onChange(event.target.value)}
      />
    )}
    {...props}
  />
);

const ProviderCode = ({ testId = 'provider' }: { testId?: string }) => {
  const { code } = usePreview();

  return <output data-testid={testId}>{code}</output>;
};

// Writes to the provider the way another uncontrolled surface (DnD) does.
const ExternalWrite = ({ next }: { next: string }) => {
  const { setCode } = usePreview();

  return <button onClick={() => setCode(next)}>external write</button>;
};

const editor = () => screen.getByTestId('editor') as HTMLTextAreaElement;
const provider = () => screen.getByTestId('provider').textContent;
const type = (text: string) =>
  fireEvent.change(editor(), { target: { value: text } });
const elapse = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('uncontrolled Editor: the provider owns the document', () => {
  it('shows each keystroke at once and reaches the provider after the debounce', () => {
    render(
      <ContextProvider>
        <TextEditor defaultValue="initial" />
        <ProviderCode />
      </ContextProvider>,
    );

    type('typed');

    expect(editor().value).toBe('typed');
    expect(provider()).toBe('initial');

    elapse(DEBOUNCE);

    expect(provider()).toBe('typed');
  });

  it('starts from the provider code when no defaultValue is given', () => {
    const Host = () => {
      const [mounted, setMounted] = useState(false);

      return (
        <ContextProvider>
          <ExternalWrite next="written first" />
          <button onClick={() => setMounted(true)}>mount editor</button>
          {mounted && <TextEditor />}
        </ContextProvider>
      );
    };

    render(<Host />);
    fireEvent.click(screen.getByText('external write'));
    fireEvent.click(screen.getByText('mount editor'));

    expect(editor().value).toBe('written first');
  });

  it('follows a provider change made by another surface', () => {
    render(
      <ContextProvider>
        <TextEditor defaultValue="initial" />
        <ExternalWrite next="from dnd" />
        <ProviderCode />
      </ContextProvider>,
    );

    fireEvent.click(screen.getByText('external write'));

    expect(editor().value).toBe('from dnd');
  });

  // The debounced push and the next keystroke can land in the same render:
  // the provider then holds the pushed value while the draft is already
  // ahead. Treating that provider change as an outside one would roll the
  // keystroke back.
  it('keeps a keystroke that lands in the same render as its own push', () => {
    render(
      <ContextProvider>
        <TextEditor defaultValue="initial" />
        <ProviderCode />
      </ContextProvider>,
    );

    type('abc');
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE);
      fireEvent.change(editor(), { target: { value: 'abcd' } });
    });

    expect(provider()).toBe('abc');
    expect(editor().value).toBe('abcd');
  });
});

describe('controlled Editor: the host owns the document', () => {
  it('notifies the host on every edit and the provider once per pause', () => {
    const onChange = vi.fn();
    // Every distinct code the provider held, in order.
    const providerCodes: string[] = [];
    const Spy = () => {
      const { code } = usePreview();

      if (providerCodes.at(-1) !== code) {
        providerCodes.push(code);
      }

      return null;
    };
    const Host = () => {
      const [value, setValue] = useState('initial');

      return (
        <ContextProvider>
          <TextEditor
            value={value}
            onChange={next => {
              onChange(next);
              setValue(next);
            }}
          />
          <Spy />
        </ContextProvider>
      );
    };

    render(<Host />);
    type('a');
    type('ab');
    type('abc');
    elapse(DEBOUNCE);

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([
      'a',
      'ab',
      'abc',
    ]);
    // The keystrokes in between never reach the provider, so the preview
    // compiles once per pause rather than once per key.
    expect(providerCodes).not.toContain('a');
    expect(providerCodes).not.toContain('ab');
    expect(providerCodes.slice(-2)).toEqual(['initial', 'abc']);
  });
});

describe('a pending push is never dropped', () => {
  it('reaches the provider when the editor unmounts inside the debounce', () => {
    const Host = () => {
      const [value, setValue] = useState('initial');
      const [shown, setShown] = useState(true);

      return (
        <ContextProvider>
          <button onClick={() => setShown(false)}>hide</button>
          {shown && <TextEditor value={value} onChange={setValue} />}
          <ProviderCode />
        </ContextProvider>
      );
    };

    render(<Host />);
    type('edited');
    fireEvent.click(screen.getByText('hide'));

    expect(provider()).toBe('edited');
  });

  it('reaches the provider when focus leaves the editor', () => {
    render(
      <ContextProvider>
        <TextEditor defaultValue="initial" />
        <ProviderCode />
      </ContextProvider>,
    );

    type('typed');
    fireEvent.blur(editor());

    expect(provider()).toBe('typed');
  });

  // Side by side with an uncontrolled DnD: clicking its panel right after
  // typing blurs the editor first, so the DnD edit starts from a document
  // that includes the typing instead of overwriting it.
  it('lets another surface build on the typing when focus moves to it', () => {
    const AppendFromProvider = () => {
      const { code, setCode } = usePreview();

      return (
        <button onClick={() => setCode(`${code} + panel`)}>panel edit</button>
      );
    };

    render(
      <ContextProvider>
        <TextEditor defaultValue="initial" />
        <AppendFromProvider />
        <ProviderCode />
      </ContextProvider>,
    );

    type('typed');
    fireEvent.blur(editor());
    fireEvent.click(screen.getByText('panel edit'));

    expect(provider()).toBe('typed + panel');
    expect(editor().value).toBe('typed + panel');
  });
});

describe('providers', () => {
  it('keep independent documents', () => {
    render(
      <>
        <ContextProvider>
          <TextEditor value="one" />
          <ProviderCode testId="first" />
        </ContextProvider>
        <ContextProvider>
          <TextEditor value="two" />
          <ProviderCode testId="second" />
        </ContextProvider>
      </>,
    );

    elapse(DEBOUNCE);

    expect(screen.getByTestId('first').textContent).toBe('one');
    expect(screen.getByTestId('second').textContent).toBe('two');
  });
});
