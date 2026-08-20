'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useError, usePreview } from '~/components/context/states';
import LiveError from '~/components/error';
import Frame, { type FrameProps } from '~/components/frame';
import { baseModules, cn, compile } from '~/utils';
import { generateTailwindCSSFromDOM } from '~/utils/tailwind';

import { type Props } from './preview';

const Client = ({
  code: _code = '',
  className,
  showError,
  props = {},
  modules = {},
  frame,
  dynamicTailwind = false,
  provider,
}: Props) => {
  const { code } = usePreview();
  const { error, setError } = useError();
  const isError = !!showError && !!error;

  const classNames = cn(isError && 'hidden', className);

  const mergedModules = { ...baseModules, ...modules };
  const effectiveCode = _code || code;

  // Scans the actual rendered DOM (via `contentRef`, attached below) rather
  // than `effectiveCode`'s source text, so classes contributed by an
  // imported component (e.g. ui-kit's `Button`) are picked up too — those
  // never appear as literal text in the previewed source, only in that
  // component's own compiled output.
  //
  // The wrapper below is tracked via a callback ref (`contentEl` state)
  // rather than a plain `useRef`, because in shadow mode it isn't mounted
  // on this component's first commit at all — `Shadow` creates its portal
  // target in its own effect and only re-renders with it afterwards, one
  // commit later. A plain ref read in an `[effectiveCode, dynamicTailwind]`
  // -keyed effect would see `null` on that first pass and never retry;
  // making the element itself a dependency re-runs the scan once it
  // actually exists.
  const [dynamicCSS, setDynamicCSS] = useState('');
  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null);
  const contentRef = useCallback((el: HTMLDivElement | null) => {
    setContentEl(el);
  }, []);

  useEffect(() => {
    if (!effectiveCode || !dynamicTailwind || !contentEl) {
      return;
    }

    let cancelled = false;

    generateTailwindCSSFromDOM(contentEl).then(css => {
      if (!cancelled) {
        setDynamicCSS(css);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [effectiveCode, dynamicTailwind, contentEl]);

  let module = null;

  if (effectiveCode) {
    try {
      module = compile(effectiveCode, mergedModules);
    } catch (e) {
      module = {
        exports: {},
        error: e instanceof Error ? e.message : 'Module transformation error',
      };
    }
  }

  const componentProps = useMemo(
    () => ({
      ...props,
    }),
    [props],
  );

  const renderProvider = (component: React.ReactNode) => {
    return provider ? provider(component) : component;
  };

  if (module && module.error) {
    return (
      <>
        <div className={cn('relative h-full w-full', classNames)}>
          <LiveError message={module.error} title="Compile Error" />
        </div>
        <LiveError.Runtime open={isError} />
      </>
    );
  }

  const Component = module?.exports?.default;

  if (!Component) {
    return null;
  }

  return (
    <>
      {frame ? (
        <div className={cn('h-full w-full', classNames)}>
          <Frame {...(frame as FrameProps)}>
            {container => (
              <div ref={contentRef} style={{ display: 'contents' }}>
                <LiveError.Boundary
                  resetKeys={[effectiveCode]}
                  onError={(e: Error) => setError(e.message)}
                >
                  {renderProvider(
                    <LiveError.Guard onError={e => setError(e.message)}>
                      <Component {...componentProps} container={container} />
                      {dynamicTailwind && dynamicCSS && (
                        <style>{dynamicCSS}</style>
                      )}
                    </LiveError.Guard>,
                  )}
                </LiveError.Boundary>
              </div>
            )}
          </Frame>
        </div>
      ) : (
        <div
          ref={contentRef}
          className={cn(
            'relative h-full w-full overflow-x-hidden overflow-y-auto',
            classNames,
          )}
          style={{
            isolation: 'isolate',
            transform: 'translateZ(0)',
            containerType: 'inline-size',
          }}
        >
          <LiveError.Boundary
            resetKeys={[effectiveCode]}
            onError={e => setError(e.message)}
          >
            {renderProvider(
              <LiveError.Guard onError={e => setError(e.message)}>
                <Component {...componentProps} />
                {dynamicTailwind && dynamicCSS && <style>{dynamicCSS}</style>}
              </LiveError.Guard>,
            )}
          </LiveError.Boundary>
        </div>
      )}
      <LiveError.Runtime open={isError} />
    </>
  );
};

export default Client;
