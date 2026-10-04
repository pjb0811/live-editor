// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Section } from '~/types';

import { useDeleteFlow } from './use-delete-flow';

const sections: Section[] = [
  { id: 'a', name: 'A', code: '<section />' },
  { id: 'b', name: 'B', code: '<section />' },
];

afterEach(() => vi.restoreAllMocks());

describe('useDeleteFlow', () => {
  it('removes at once without onBeforeDelete', () => {
    const remove = vi.fn();
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useDeleteFlow({ sections, remove }));

    result.current('a', onDeleted);

    expect(remove).toHaveBeenCalledWith('a');
    expect(onDeleted).toHaveBeenCalled();
  });

  it.each([
    [true, 1],
    [false, 0],
  ])('follows a synchronous %s answer', (answer, calls) => {
    const remove = vi.fn();
    const onBeforeDelete = vi.fn(() => answer);
    const { result } = renderHook(() =>
      useDeleteFlow({ sections, remove, onBeforeDelete }),
    );

    result.current('b');

    expect(onBeforeDelete).toHaveBeenCalledWith(sections[1]);
    expect(remove).toHaveBeenCalledTimes(calls);
  });

  it('removes with the remove of the latest render once a promise resolves', async () => {
    const first = vi.fn();
    const latest = vi.fn();
    let confirm!: (allowed: boolean) => void;
    const onBeforeDelete = () =>
      new Promise<boolean>(resolve => {
        confirm = resolve;
      });
    const { result, rerender } = renderHook(
      ({ remove }) => useDeleteFlow({ sections, remove, onBeforeDelete }),
      { initialProps: { remove: first } },
    );

    result.current('a');
    rerender({ remove: latest });
    confirm(true);
    await Promise.resolve();

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith('a');
  });

  it('keeps the section when onBeforeDelete throws or rejects', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const remove = vi.fn();
    const throwing = renderHook(() =>
      useDeleteFlow({
        sections,
        remove,
        onBeforeDelete: () => {
          throw new Error('no');
        },
      }),
    );
    const rejecting = renderHook(() =>
      useDeleteFlow({
        sections,
        remove,
        onBeforeDelete: () => Promise.reject(new Error('no')),
      }),
    );

    throwing.result.current('a');
    rejecting.result.current('a');
    await Promise.resolve();

    expect(remove).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("doesn't ask about an id that isn't a section", () => {
    const remove = vi.fn();
    const onBeforeDelete = vi.fn(() => false);
    const { result } = renderHook(() =>
      useDeleteFlow({ sections, remove, onBeforeDelete }),
    );

    result.current('missing');

    expect(onBeforeDelete).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith('missing');
  });
});
