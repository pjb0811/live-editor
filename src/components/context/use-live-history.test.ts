// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type LiveHistoryOptions, useLiveHistory } from './use-live-history';

const DND = { source: 'dnd' } as const;
const EDITOR = { source: 'editor' } as const;

// `Date.now()` as the test sets it, for the merge window.
let now = 0;

vi.spyOn(Date, 'now').mockImplementation(() => now);

afterEach(() => {
  now = 0;
});

const setup = (options?: LiveHistoryOptions) =>
  renderHook(() => useLiveHistory('a', options)).result;

const type = (result: ReturnType<typeof setup>, value: string, at: number) => {
  now = at;
  act(() => result.current.onChange(value, EDITOR));
};

describe('useLiveHistory', () => {
  it('records each dnd change as one step', () => {
    const result = setup();

    act(() => result.current.onChange('b', DND));
    act(() => result.current.onChange('c', DND));
    expect(result.current.value).toBe('c');

    act(() => result.current.undo());
    expect(result.current.value).toBe('b');

    act(() => result.current.undo());
    expect(result.current.value).toBe('a');
    expect(result.current.canUndo).toBe(false);
  });

  it('records a change without a source, and set, as one step each', () => {
    const result = setup();

    act(() => result.current.onChange('b'));
    act(() => result.current.set('c'));
    act(() => result.current.undo());

    expect(result.current.value).toBe('b');
  });

  it('merges a burst of typing into one step that restores the value before it', () => {
    const result = setup({ mergeWindow: 500 });

    type(result, 'ab', 1000);
    type(result, 'abc', 1400);
    type(result, 'abcd', 1800);
    expect(result.current.value).toBe('abcd');

    act(() => result.current.undo());
    expect(result.current.value).toBe('a');
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.redo());
    expect(result.current.value).toBe('abcd');
  });

  it('starts a new step after a pause longer than the window', () => {
    const result = setup({ mergeWindow: 500 });

    type(result, 'ab', 1000);
    type(result, 'abc', 1600);
    act(() => result.current.undo());

    expect(result.current.value).toBe('ab');
  });

  it('ends a burst at a dnd change', () => {
    const result = setup();

    type(result, 'ab', 1000);
    now = 1100;
    act(() => result.current.onChange('ab!', DND));
    type(result, 'ab!c', 1200);

    act(() => result.current.undo());
    expect(result.current.value).toBe('ab!');

    act(() => result.current.undo());
    expect(result.current.value).toBe('ab');
  });

  it('ends a burst at an undo, so the next keystroke adds a step', () => {
    const result = setup();

    act(() => result.current.onChange('b', DND));
    type(result, 'bc', 1000);
    act(() => result.current.undo());
    type(result, 'bx', 1100);

    expect(result.current.value).toBe('bx');

    act(() => result.current.undo());
    expect(result.current.value).toBe('b');
  });

  it('drops the redo branch on a new step', () => {
    const result = setup();

    act(() => result.current.onChange('b', DND));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.onChange('c', DND));
    expect(result.current.canRedo).toBe(false);
  });

  it('adds nothing for a value equal to the current one, and starts no burst', () => {
    const result = setup();

    type(result, 'a', 1000);
    expect(result.current.canUndo).toBe(false);

    // Not merged into the no-op above: the value before it is kept.
    type(result, 'ab', 1100);
    act(() => result.current.undo());
    expect(result.current.value).toBe('a');
  });

  it('keeps only the last limit steps', () => {
    const result = setup({ limit: 2 });

    act(() => result.current.onChange('b', DND));
    act(() => result.current.onChange('c', DND));
    act(() => result.current.onChange('d', DND));
    act(() => result.current.undo());
    act(() => result.current.undo());
    act(() => result.current.undo());

    expect(result.current.value).toBe('b');
  });

  it('resets to a new value and clears the history', () => {
    const result = setup();

    act(() => result.current.onChange('b', DND));
    act(() => result.current.reset('z'));

    expect(result.current.value).toBe('z');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});

describe('useLiveHistory shortcuts', () => {
  const press = (
    target: EventTarget,
    key: string,
    init: KeyboardEventInit = {},
  ) => {
    const event = new KeyboardEvent('keydown', {
      key,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
      ...init,
    });

    act(() => {
      target.dispatchEvent(event);
    });

    return event;
  };

  it('undoes on Ctrl+Z and redoes on Ctrl+Shift+Z and Ctrl+Y', () => {
    const result = setup();

    act(() => result.current.onChange('b', DND));

    const event = press(document.body, 'z');

    expect(event.defaultPrevented).toBe(true);
    expect(result.current.value).toBe('a');

    press(document.body, 'Z', { shiftKey: true });
    expect(result.current.value).toBe('b');

    act(() => result.current.undo());
    press(document.body, 'y');
    expect(result.current.value).toBe('b');
  });

  it.each([
    ['an input', () => document.createElement('input')],
    ['a text area', () => document.createElement('textarea')],
    [
      'the code editor',
      () => {
        const editor = document.createElement('div');
        const content = document.createElement('div');

        editor.className = 'cm-editor';
        editor.append(content);

        return content;
      },
    ],
  ])('leaves Ctrl+Z inside %s alone', (_, create) => {
    const result = setup();
    const element = create();

    document.body.append(element.closest('.cm-editor') ?? element);
    act(() => result.current.onChange('b', DND));

    const event = press(element, 'z');

    expect(event.defaultPrevented).toBe(false);
    expect(result.current.value).toBe('b');

    (element.closest('.cm-editor') ?? element).remove();
  });

  it('binds nothing with shortcuts: false', () => {
    const result = setup({ shortcuts: false });

    act(() => result.current.onChange('b', DND));
    press(document.body, 'z');

    expect(result.current.value).toBe('b');
  });
});
