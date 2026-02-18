'use client';

import { useMemo } from 'react';

import { useError, usePreview } from '~/components/Context/states';
import LiveError from '~/components/Error';
import type { FrameProps } from '~/components/Frame';
import Frame from '~/components/Frame';
import { baseModules, cn, compile } from '~/utils';

import { type Props } from '../';

const Client = ({
  code: _code = '',
  className,
  showError,
  props = {},
  modules = {},
  frame,
  provider,
}: Props) => {
  const { code } = usePreview();
  const { error, setError } = useError();
  const isError = !!showError && !!error;

  const classNames = cn(isError && 'hidden', className);

  const mergedModules = { ...baseModules, ...modules };

  let module = null;

  if (_code || code) {
    try {
      module = compile(_code || code, mergedModules);
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
              <LiveError.Boundary onError={(e: Error) => setError(e.message)}>
                {renderProvider(
                  <LiveError.Guard onError={e => setError(e.message)}>
                    <Component {...componentProps} container={container} />
                  </LiveError.Guard>,
                )}
              </LiveError.Boundary>
            )}
          </Frame>
        </div>
      ) : (
        <div
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
          <LiveError.Boundary onError={e => setError(e.message)}>
            {renderProvider(
              <LiveError.Guard onError={e => setError(e.message)}>
                <Component {...componentProps} />
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
