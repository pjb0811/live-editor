'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';

import { useElementSize } from '@jax/use-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';

import { useError, usePreview } from '~/components/Context/states';
import LiveError from '~/components/Error';
import { cn } from '~/utils';
import { baseModules, compile } from '~/utils';

import { type IframeProps, type Props } from '../';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }: { queryKey: readonly unknown[] }) => {
        const [path, params = {}] = queryKey as [
          string,
          Record<string, string>,
        ];

        const { data } = await axios.get(path, {
          params,
        });

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
  const iframeRootRef = useRef<ReactDOM.Root | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const styleManagerRef = useRef<{
    copiedLinks: Set<string>;
    copiedStyles: Set<string>;
  }>({
    copiedLinks: new Set(),
    copiedStyles: new Set(),
  });

  const { breakpoint, ref } = useElementSize<HTMLDivElement>();

  const { code } = usePreview();
  const { error, setError } = useError();

  const [loaded, setLoaded] = useState(false);

  const previewId = id || 'live-preview';
  const isError = !!showError && !!error;

  const classNames = cn(
    isError && 'hidden',
    className,
    //
  );

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
      breakpoint,
      ...(iframe && loaded && iframeRef.current?.contentDocument?.body
        ? { container: iframeRef.current.contentDocument.body }
        : !iframe && ref.current
          ? { container: ref.current } // 일반 모드에서 container 전달
          : {}),
    }),
    [props, breakpoint, iframe, loaded, ref],
  );

  const Component = useMemo(
    () => module?.exports?.default || (() => null),
    [module?.exports?.default],
  );

  const iframeRender = useCallback(() => {
    if (!iframe || !loaded || !iframeRef.current) {
      return;
    }

    const doc = iframeRef.current.contentDocument;

    if (!doc) {
      return;
    }

    let mountNode = doc.getElementById('iframe-root');

    if (!mountNode) {
      mountNode = doc.createElement('div');
      mountNode.id = 'iframe-root';
      doc.body.appendChild(mountNode);
    }

    if (!iframeRootRef.current) {
      iframeRootRef.current = ReactDOM.createRoot(mountNode);
    }

    if (module && 'error' in module) {
      setError(module.error);
      iframeRootRef.current.render(
        <LiveError message={module.error} title="컴파일 오류" />,
      );
      return;
    }

    if (Component) {
      iframeRootRef.current.render(
        <LiveError.Boundary onError={e => setError(e.message)}>
          <QueryClientProvider client={queryClient}>
            <Component {...componentProps} />
          </QueryClientProvider>
        </LiveError.Boundary>,
      );
      setError(null);
    }
  }, [module, loaded, iframe, componentProps, setError, Component]);

  const copyStyles = useCallback(() => {
    const $iframe = iframeRef.current?.contentDocument;
    if (!$iframe) {
      return;
    }

    const manager = styleManagerRef.current;

    const links = document.querySelectorAll<HTMLLinkElement>(
      'link[rel="stylesheet"]',
    );
    const newLinks = Array.from(links)
      .map(link => link.href)
      .filter(href => !manager.copiedLinks.has(href));

    if (newLinks.length) {
      const fragment = $iframe.createDocumentFragment();
      newLinks.forEach(href => {
        const link = $iframe.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        fragment.appendChild(link);
        manager.copiedLinks.add(href);
      });
      $iframe.head.appendChild(fragment);
    }

    const styles = document.querySelectorAll<HTMLStyleElement>('style');
    const newStyles = Array.from(styles)
      .map(style => style.textContent || '')
      .filter(content => {
        if (!content) {
          return false;
        }

        const hash = content.length + content.slice(0, 50);
        if (manager.copiedStyles.has(hash)) {
          return false;
        }

        manager.copiedStyles.add(hash);
        return true;
      });

    if (newStyles.length) {
      const fragment = $iframe.createDocumentFragment();
      newStyles.forEach(content => {
        const style = $iframe.createElement('style');
        style.textContent = content;
        fragment.appendChild(style);
      });
      $iframe.head.appendChild(fragment);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (iframeRootRef.current) {
        setTimeout(() => {
          try {
            iframeRootRef.current?.unmount();
          } catch (error) {
            console.warn('iframe root unmount failed:', error);
          } finally {
            iframeRootRef.current = null;
          }
        }, 0);
      }
    };
  }, []);

  useEffect(() => {
    if (!iframe) {
      return;
    }

    const $iframe = iframeRef.current;

    if (!$iframe) {
      return;
    }

    const onLoad = () => {
      const doc = $iframe.contentDocument;

      if (!doc) {
        return;
      }

      doc.body.style.overflowX = 'hidden';

      copyStyles();

      if (scripts.length) {
        const fragment = doc.createDocumentFragment();
        scripts.forEach(src => {
          const script = doc.createElement('script');
          script.src = src;
          script.async = true;
          fragment.appendChild(script);
        });
        doc.head.appendChild(fragment);
      }

      setLoaded(true);
    };

    $iframe.addEventListener('load', onLoad);

    let timeoutId: number;
    const observer = new MutationObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(copyStyles, 50);
    });

    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
    });

    if ($iframe.contentDocument?.readyState === 'complete') {
      onLoad();
    }

    return () => {
      $iframe.removeEventListener('load', onLoad);
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [iframe, scripts, copyStyles]);

  useEffect(() => {
    if (iframe) {
      iframeRender();
    }
  }, [iframe, iframeRender]);

  if (!iframe && module && 'error' in module) {
    return (
      <>
        <div ref={ref} className={cn('relative h-full w-full', classNames)}>
          <LiveError message={module.error} title="컴파일 오류" />
        </div>
        <LiveError.Runtime open={isError} />
      </>
    );
  }

  return (
    <>
      {iframe ? (
        <div ref={ref} className={cn('h-full w-full', classNames)}>
          <iframe
            id={previewId}
            ref={iframeRef}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              ...style,
            }}
            title={title ?? 'Live Preview'}
            sandbox={sandbox ?? 'allow-scripts allow-same-origin'}
          />
        </div>
      ) : (
        <div
          ref={ref}
          className={cn(
            'relative',
            'h-full w-full',
            'overflow-x-hidden overflow-y-auto',
            classNames,
          )}
          style={{
            isolation: 'isolate',
            transform: 'translateZ(0)',
            containerType: 'inline-size',
          }}
        >
          {Component && (
            <LiveError.Boundary onError={e => setError(e.message)}>
              <QueryClientProvider client={queryClient}>
                <Component {...componentProps} />
              </QueryClientProvider>
            </LiveError.Boundary>
          )}
        </div>
      )}
      <LiveError.Runtime open={isError} />
    </>
  );
};

export default Client;
