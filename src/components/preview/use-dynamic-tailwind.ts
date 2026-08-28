import { useCallback, useEffect, useState } from 'react';

import { generateTailwindCSSFromDOM } from '~/utils/tailwind';

// Compiles the Tailwind classes found in rendered output and returns them as
// a CSS string for the caller to inject as a `<style>` tag. Shared by
// `preview/client.tsx` and `dnd/renderer.tsx`, which previously carried
// byte-identical copies of this logic and of the comments below (see #246).
//
// Scans the live DOM (whatever the returned `ref` is attached to) rather than
// the source text it was rendered from, so classes contributed by an imported
// component (e.g. ui-kit's `Button`) are picked up too — those never appear as
// literal text in the previewed source, only in that component's own compiled
// output.
//
// The scanned element is tracked as state via a callback ref rather than a
// plain `useRef`, because in shadow mode it isn't mounted on the caller's
// first commit at all — `Shadow` creates its portal target in its own effect
// and only re-renders with it afterwards, one commit later. A plain ref read
// in a `[code, enabled]`-keyed effect would see `null` on that first pass and
// never retry; making the element itself a dependency re-runs the scan once
// it actually exists.
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

    generateTailwindCSSFromDOM(element).then(next => {
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
