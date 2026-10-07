'use client';

import { useMemo } from 'react';

import { useLiveMessages } from '~/components/context/messages';
import { useError, usePreview } from '~/components/context/states';
import LiveError from '~/components/error';
import Frame, { type FrameProps } from '~/components/frame';
import { cn } from '~/utils/cn';

import { NO_MODULES, NO_PROPS } from './defaults';
import { type Props } from './preview';
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
}: Props) => {
  const { code } = usePreview();
  const { error, setError } = useError();
  const messages = useLiveMessages();
  const errorVisible = !!showError && !!error;

  const classNames = cn(errorVisible && 'hidden', className);

  const effectiveCode = _code === undefined ? code : _code;

  const module = useCompiledModule(effectiveCode, modules);

  // Attached to the wrapper below; scans the rendered DOM so classes coming
  // from an imported component are picked up too. See the hook for details.
  const { ref: contentRef, css: dynamicCSS } = useDynamicTailwind(
    effectiveCode,
    dynamicTailwind,
  );

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
          <LiveError message={module.error} title={messages.errors.compile} />
        </div>
        <LiveError.Runtime open={errorVisible} />
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
      <LiveError.Runtime open={errorVisible} />
    </>
  );
};

export default Client;
