'use client';

import { useMemo } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';

import { useError, usePreview } from '~/components/Context/states';
import LiveError from '~/components/Error';
import { cn } from '~/utils';
import { baseModules, compile } from '~/utils';

import { type IframeProps, type Props } from '../';
import IFrame from '../IFrame';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }: { queryKey: readonly unknown[] }) => {
        const [path, params = {}] = queryKey as [
          string,
          Record<string, string>,
        ];
        const { data } = await axios.get(path, { params });
        return data;
      },
    },
  },
});

const Client = ({
  id,
  code: _code = '',
  className,
  showError,
  props = {},
  modules = {},
  iframe,
  scripts = [],
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
      module = { error: e instanceof Error ? e.message : 'transform error' };
    }
  }

  const componentProps = useMemo(
    () => ({
      ...props,
    }),
    [props],
  );

  if (module && 'error' in module) {
    return (
      <>
        <div className={cn('relative h-full w-full', classNames)}>
          <LiveError message={module.error} title="컴파일 오류" />
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
                <QueryClientProvider client={queryClient}>
                  <Component {...componentProps} container={container} />
                </QueryClientProvider>
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
            <QueryClientProvider client={queryClient}>
              <Component {...componentProps} />
            </QueryClientProvider>
          </LiveError.Boundary>
        </div>
      )}
      <LiveError.Runtime open={isError} />
    </>
  );
};

export default Client;
