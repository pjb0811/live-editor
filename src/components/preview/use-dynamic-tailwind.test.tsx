// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDynamicTailwind } from './use-dynamic-tailwind';

// A mock factory runs only when the module is actually imported, so whether
// it ran says whether the Tailwind compiler was loaded at all (#332).
const tailwind = vi.hoisted(() => ({
  loaded: vi.fn(),
  generate: vi.fn(async (root: Element) => {
    return `.scanned{--classes:"${root.className}"}`;
  }),
}));

vi.mock('~/utils/tailwind', () => {
  tailwind.loaded();

  return { generateTailwindCSSFromDOM: tailwind.generate };
});

afterEach(() => {
  vi.restoreAllMocks();
});

const withElement = (enabled: boolean) => {
  const element = document.createElement('div');

  element.className = 'p-6';

  const { result, rerender } = renderHook(
    ({ code }) => useDynamicTailwind(code, enabled),
    { initialProps: { code: 'const App = 1;' } },
  );

  // Attach the scanned element through the returned callback ref, the way a
  // rendered wrapper would.
  act(() => result.current.ref(element));

  return { result, rerender };
};

describe('useDynamicTailwind', () => {
  it('does not load the Tailwind compiler while dynamicTailwind is off', async () => {
    const { result } = withElement(false);

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(tailwind.loaded).not.toHaveBeenCalled();
    expect(result.current.css).toBe('');
  });

  it('loads it on demand and returns the compiled CSS when on', async () => {
    const { result } = withElement(true);

    await waitFor(() =>
      expect(result.current.css).toBe('.scanned{--classes:"p-6"}'),
    );
    expect(tailwind.loaded).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  // #699: a failure used to be an unhandled rejection, which Vitest would
  // report and fail this test with.
  it('reports a failed compile and keeps the previous CSS', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, rerender } = withElement(true);

    await waitFor(() =>
      expect(result.current.css).toBe('.scanned{--classes:"p-6"}'),
    );

    tailwind.generate.mockRejectedValueOnce(new Error('compile failed'));
    rerender({ code: 'const App = 2;' });

    await waitFor(() =>
      expect(result.current.error?.message).toBe('compile failed'),
    );
    expect(result.current.css).toBe('.scanned{--classes:"p-6"}');
    expect(log).toHaveBeenCalledWith(
      'Generating the preview Tailwind CSS failed',
      expect.objectContaining({ message: 'compile failed' }),
    );
  });
});
