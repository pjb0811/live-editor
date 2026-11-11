import { useLayoutEffect, useMemo } from 'react';

import { useMergedRef } from '@jbpark/use-hooks';

import { useLiveMessages } from '~/components/context/messages';
import { useError, usePreview } from '~/components/context/states';
import LiveError from '~/components/error';
import Frame, { type FrameProps } from '~/components/frame';
import { useIsClient } from '~/components/frame/use-is-client';
import { cn } from '~/utils/cn';

import styles from './preview.module.css';

import { NO_MODULES, NO_PROPS } from './defaults';
import { renderStableComponent } from './stable-component';
import type { Props } from './types';
import { useCompiledModule } from './use-compiled-module';
import { useDynamicTailwind } from './use-dynamic-tailwind';

const Client = ({
  code: _code,
  className,
  showError,
  props = NO_PROPS,
  modules = NO_MODULES,
  frame,
  dynamicTailwind = false,
  provider,
  // Kept out of the DOM; it has no effect.
  container: _container,
  style,
  ref,
  // The remaining div props, for the outer wrapper in every branch (#721).
  ...divProps
}: Props) => {
  const { code } = usePreview();
  const { error, setError } = useError();
  const messages = useLiveMessages();
  const isError = !!showError && !!error;

  const classNames = cn(isError && styles.hidden, className);

  const effectiveCode = _code === undefined ? code : _code;

  const isClient = useIsClient();

  // A frame renders nothing on the server, so the code isn't compiled or run
  // there. Without one the server renders the preview, as before (#716).
  const module = useCompiledModule(
    frame && !isClient ? '' : effectiveCode,
    modules,
  );

  // Clears the error when the code changes, as the provider's `setCode`
  // does, which a `code` prop never calls (#714). In the cleanup, which runs
  // before the new code's own render error is reported, so that one stays.
  useLayoutEffect(() => () => setError(null), [effectiveCode, setError]);

  // Attached to the wrapper below; scans the rendered DOM so classes coming
  // from an imported component are picked up too. See the hook for details.
  const { ref: contentRef, css: dynamicCSS } = useDynamicTailwind(
    effectiveCode,
    dynamicTailwind,
  );

  const mergedRef = useMergedRef(contentRef, ref);

  const componentProps = useMemo(
    () => ({
      ...props,
    }),
    [props],
  );

  const clearError = () => setError(null);

  const renderProvider = (component: React.ReactNode) => {
    return provider ? provider(component) : component;
  };

  if (module && module.error) {
    return (
      <>
        <div
          {...divProps}
          ref={ref}
          className={cn(styles.fill, classNames)}
          style={style}
        >
          <LiveError message={module.error} title={messages.errors.compile} />
        </div>
        <LiveError.Runtime open={isError} reset={clearError} />
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
        <div
          {...divProps}
          ref={ref}
          className={cn(styles.fill, classNames)}
          style={style}
        >
          <Frame {...(frame as FrameProps)}>
            {container => (
              <div ref={contentRef} style={{ display: 'contents' }}>
                <LiveError.Boundary
                  resetKeys={[effectiveCode]}
                  onError={(e: Error) => setError(e.message)}
                >
                  {renderProvider(
                    <LiveError.Guard onError={e => setError(e.message)}>
                      {/* Keeps the DOM when an edit leaves the hooks alone. */}
                      {renderStableComponent(Component, effectiveCode, {
                        ...componentProps,
                        container,
                      })}
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
          {...divProps}
          ref={mergedRef}
          className={cn(styles.fill, styles.scroll, classNames)}
          // The host's style last, so it can override these, as in
          // `Live.Error`.
          style={{
            isolation: 'isolate',
            transform: 'translateZ(0)',
            containerType: 'inline-size',
            ...style,
          }}
        >
          <LiveError.Boundary
            resetKeys={[effectiveCode]}
            onError={e => setError(e.message)}
          >
            {renderProvider(
              <LiveError.Guard onError={e => setError(e.message)}>
                {renderStableComponent(
                  Component,
                  effectiveCode,
                  componentProps,
                )}
                {dynamicTailwind && dynamicCSS && <style>{dynamicCSS}</style>}
              </LiveError.Guard>,
            )}
          </LiveError.Boundary>
        </div>
      )}
      <LiveError.Runtime open={isError} reset={clearError} />
    </>
  );
};

export default Client;
