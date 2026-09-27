// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDynamicTailwind } from './use-dynamic-tailwind';

// A mock factory runs only when the module is actually imported, so whether
// it ran says whether the Tailwind compiler was loaded at all (#332).
const tailwind = vi.hoisted(() => ({ loaded: vi.fn() }));

vi.mock('~/utils/tailwind', () => {
  tailwind.loaded();

  return {
    generateTailwindCSSFromDOM: async (root: Element) =>
      `.scanned{--classes:"${root.className}"}`,
  };
});

const withElement = (enabled: boolean) => {
  const element = document.createElement('div');

  element.className = 'p-6';

  const { result } = renderHook(() => {
    const tailwindState = useDynamicTailwind('const App = 1;', enabled);

    return tailwindState;
  });

  // Attach the scanned element through the returned callback ref, the way a
  // rendered wrapper would.
  result.current.ref(element);

  return result;
};

describe('useDynamicTailwind', () => {
  it('does not load the Tailwind compiler while dynamicTailwind is off', async () => {
    const result = withElement(false);

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(tailwind.loaded).not.toHaveBeenCalled();
    expect(result.current.css).toBe('');
  });

  it('loads it on demand and returns the compiled CSS when on', async () => {
    const result = withElement(true);

    await waitFor(() =>
      expect(result.current.css).toBe('.scanned{--classes:"p-6"}'),
    );
    expect(tailwind.loaded).toHaveBeenCalledTimes(1);
  });
});
