'use client';

import { useMemo } from 'react';

import { useError, usePreview } from '~/components/Context/states';
import LiveError from '~/components/Error';
import { baseModules, cn, compile } from '~/utils';

import { type IframeProps, type Props } from '../';
import IFrame from '../IFrame';

const Client = ({
  id,
  code: _code = '',
  className,
  showError,
  props = {},
  modules = {},
  iframe,
  scripts = [],
  provider,
}: Props) => {
  const { code } = usePreview();
  const { error, setError } = useError();

  const previewId = id || 'live-preview';
  const isError = !!showError && !!error;

  const classNames = cn(isError && 'hidden', className);
  const { style, title, sandbox } = (iframe ?? {}) as IframeProps;

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
      {iframe ? (
        <div className={cn('h-full w-full', classNames)}>
          <IFrame
            id={previewId}
            title={title}
            sandbox={sandbox}
            style={style}
            scripts={scripts}
          >
            {container => (
              <LiveError.Boundary onError={(e: Error) => setError(e.message)}>
                {renderProvider(
                  <LiveError.Guard onError={e => setError(e.message)}>
                    <Component {...componentProps} container={container} />
                  </LiveError.Guard>,
                )}
              </LiveError.Boundary>
            )}
          </IFrame>
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
