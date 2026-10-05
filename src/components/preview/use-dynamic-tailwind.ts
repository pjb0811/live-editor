import { useCallback, useEffect, useState } from 'react';

// Compiles the Tailwind classes in the rendered DOM into CSS for a `<style>`
// tag, for `Live.Preview` and each canvas section. Reading the DOM, not the
// source, finds the classes imported components add too.
//
// The element is held in state through a callback ref: in shadow mode it
// appears a commit later, and an effect reading a plain ref would miss it.
// The compiler and theme load on first use, since they're large (#332).
export const useDynamicTailwind = (code: string, enabled: boolean) => {
  const [css, setCss] = useState('');
  const [element, setElement] = useState<HTMLDivElement | null>(null);

  const ref = useCallback((node: HTMLDivElement | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!code || !enabled || !element) {
      return;
    }

    let cancelled = false;

    import('~/utils/tailwind')
      .then(({ generateTailwindCSSFromDOM }) =>
        generateTailwindCSSFromDOM(element),
      )
      .then(next => {
        if (!cancelled) {
          setCss(next);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, enabled, element]);

  return { ref, css };
};
