import { useCallback, useEffect, useState } from 'react';

import { useAsync } from '@jbpark/use-hooks';

// Compiles the Tailwind classes in the rendered DOM into CSS for a `<style>`
// tag, for `Live.Preview` and each canvas section. Reading the DOM, not the
// source, finds the classes imported components add too.
//
// The element is held in state through a callback ref: in shadow mode it
// appears a commit later, and an effect reading a plain ref would miss it.
// The compiler and theme load on first use, since they're large (#332).
//
// `css` keeps the last compiled result while the next one runs, while it's
// off, and after a failure. A failure is logged and returned as `error`.
export const useDynamicTailwind = (code: string, enabled: boolean) => {
  const [element, setElement] = useState<HTMLDivElement | null>(null);

  const ref = useCallback((node: HTMLDivElement | null) => {
    setElement(node);
  }, []);

  const { value: css = '', error } = useAsync(
    async () => {
      const { generateTailwindCSSFromDOM } = await import('~/utils/tailwind');

      return generateTailwindCSSFromDOM(element!);
    },
    [code, element],
    { enabled: enabled && !!code && !!element },
  );

  useEffect(() => {
    if (error) {
      console.error('Generating the preview Tailwind CSS failed', error);
    }
  }, [error]);

  return { ref, css, error };
};
