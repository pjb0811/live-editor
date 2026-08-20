import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import Frame, { type FrameProps } from '~/components/frame';
import { baseModules, compile } from '~/utils';
import { generateTailwindCSSFromDOM } from '~/utils/tailwind';

interface Props {
  preview: string;
  modules?: Record<string, unknown>;
  headers?: Record<string, boolean>;
  frame?: FrameProps;
  dynamicTailwind?: boolean;
  provider?: (children: React.ReactNode) => React.ReactNode;
}

// Wrapped in memo() because `preview` is a plain string: for a section that
// didn't change, the parent hands back the same content it computed last
// render (see generateSections()/dnd.tsx), so a shallow prop comparison
// lets React skip both the recompile below and reconciling this section's
// iframe tree at all — see #97.
const Renderer = ({
  preview,
  headers,
  modules,
  frame,
  dynamicTailwind = false,
  provider,
}: Props) => {
  const memoizedModules = useMemo(
    () => ({
      ...baseModules,
      ...modules,
    }),
    [modules],
  );

  const module = useMemo(() => {
    try {
      return compile(preview, memoizedModules);
    } catch (e) {
      return {
        exports: {},
        error: e instanceof Error ? e.message : 'Module transformation error',
      };
    }
  }, [preview, memoizedModules]);

  // In `shadow` mode there's no separate document to load a stylesheet into
  // — the shadow root only gets whatever CSS naturally inherits across the
  // boundary (see `frame/shadow.tsx`), not utility classes. Mirrors
  // `preview/client.tsx`'s `dynamicTailwind` handling: compile this
  // section's own Tailwind classes and portal them in as a `<style>` tag
  // alongside the rendered content, which crosses the shadow boundary fine
  // since it lives inside the same portal target.
  //
  // Scans the actual rendered DOM (below) rather than the `preview` source
  // text, so classes contributed by an imported component (e.g. ui-kit's
  // `Button`) are picked up too — those never appear as literal text in
  // `preview`, only in the component's own compiled output.
  //
  // The wrapper below is tracked via a callback ref (`wrapperEl` state)
  // rather than a plain `useRef`, because in shadow mode it isn't mounted
  // on this component's first commit at all — `Shadow` creates its portal
  // target in its own effect and only re-renders with it afterwards, one
  // commit later. A plain ref read in a `[preview, dynamicTailwind]`-keyed
  // effect would see `null` on that first pass and never retry; making the
  // element itself a dependency re-runs the scan once it actually exists.
  const [dynamicCSS, setDynamicCSS] = useState('');
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null);
  const wrapperRef = useCallback((el: HTMLDivElement | null) => {
    setWrapperEl(el);
  }, []);

  useEffect(() => {
    if (!preview || !dynamicTailwind || !wrapperEl) {
      return;
    }

    let cancelled = false;

    generateTailwindCSSFromDOM(wrapperEl).then(css => {
      if (!cancelled) {
        setDynamicCSS(css);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [preview, dynamicTailwind, wrapperEl]);

  const renderProvider = (component: React.ReactNode) => {
    return provider ? provider(component) : component;
  };

  const Component = module.exports.default;

  if (!Component) {
    return null;
  }

  return (
    <Frame {...frame} autoHeight>
      {container => (
        <div
          ref={wrapperRef}
          className="w-full overflow-x-hidden"
          data-editor-mode
        >
          {renderProvider(
            <>
              <Component
                headers={headers}
                container={container}
                //
              />
              {dynamicTailwind && dynamicCSS && <style>{dynamicCSS}</style>}
            </>,
          )}
        </div>
      )}
    </Frame>
  );
};

export default memo(Renderer);
