'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { useElementSize } from 'use-hooks';

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
  const normalRootRef = useRef<ReactDOM.Root | null>(null);

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
      ...(iframe
        ? { container: iframeRef.current?.contentDocument?.body }
        : {}),
    }),
    [props, breakpoint, iframe],
  );

  const getCurrentRoot = useCallback(() => {
    return iframe ? iframeRootRef : normalRootRef;
  }, [iframe]);

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

  const cleanupAll = useCallback(() => {
    styleManagerRef.current = {
      copiedLinks: new Set(),
      copiedStyles: new Set(),
    };

    [iframeRootRef, normalRootRef].forEach((rootRef, index) => {
      if (rootRef.current) {
        const currentRoot = rootRef.current;
        rootRef.current = null;

        setTimeout(() => {
          try {
            currentRoot.unmount();
          } catch (error) {
            console.warn(
              `Root ${index === 0 ? 'iframe' : 'normal'} unmount failed:`,
              error,
            );
          }
        }, 0);
      }
    });
  }, []);

  const cleanupUnusedRoot = useCallback(() => {
    const unusedRootRef = iframe ? normalRootRef : iframeRootRef;

    if (unusedRootRef.current) {
      setTimeout(() => {
        try {
          unusedRootRef.current?.unmount();
        } catch (error) {
          console.warn('Unused root cleanup failed:', error);
        } finally {
          unusedRootRef.current = null;
        }
      }, 0);
    }
  }, [iframe]);

  const previewRender = useCallback(() => {
    const $preview = document.getElementById(previewId);
    const currentRootRef = getCurrentRoot();

    if (!$preview || !module) {
      return;
    }

    cleanupUnusedRoot();

    let mountTarget: Element;

    if (iframe) {
      if (!iframeRef.current || !loaded) {
        return;
      }

      const $iframe = iframeRef.current;
      const doc = $iframe.contentDocument;

      if (!doc) {
        return;
      }

      let mountNode = doc.getElementById('iframe-root');

      if (!mountNode) {
        mountNode = doc.createElement('div');
        mountNode.id = 'iframe-root';
        doc.body.appendChild(mountNode);
      }

      mountTarget = mountNode;
    } else {
      mountTarget = $preview;
    }

    if (!currentRootRef.current) {
      currentRootRef.current = ReactDOM.createRoot(mountTarget);
    }

    if (module && 'error' in module) {
      setError(module.error);
      currentRootRef.current.render(
        <LiveError error={module.error} title="컴파일 오류" />,
      );
      return;
    }

    if (module?.exports?.default) {
      const Component = module.exports.default;

      currentRootRef.current.render(
        <LiveError.Boundary onError={e => setError(e.message)}>
          <QueryClientProvider client={queryClient}>
            <Component {...componentProps} />
          </QueryClientProvider>
        </LiveError.Boundary>,
      );
      setError(null);
    }
  }, [
    module,
    loaded,
    iframe,
    previewId,
    componentProps,
    setError,
    cleanupUnusedRoot,
    getCurrentRoot,
  ]);

  useEffect(() => {
    return cleanupAll;
  }, [cleanupAll]);

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

    let timeoutId: NodeJS.Timeout;
    const observer = new MutationObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(copyStyles, 50);
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
    previewRender();
  }, [previewRender]);

  return (
    <>
      <div
        ref={ref}
        className={cn(
          'h-full w-full',
          classNames,
          //
        )}
      >
        {iframe ? (
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
        ) : (
          <>
            {scripts.map((src, index) => (
              <script key={index} src={src} async />
            ))}
            <div id={previewId} />
          </>
        )}
      </div>
      <LiveError.Runtime open={isError} />
    </>
  );
};

export default Client;
