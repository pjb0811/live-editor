'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { useElementSize } from 'use-hooks';

import { useError, usePreview } from '~/components/Context/states';
import LiveError from '~/components/Error';
import { cn } from '~/utils';
import { baseModules, compileModule } from '~/utils';

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
  const previewRef = useRef<ReactDOM.Root>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { breakpoint, elementRef } = useElementSize<HTMLDivElement>();

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

  const previewRender = useCallback(
    (code: string) => {
      const $preview = document.getElementById(previewId);

      if (!$preview || !code) {
        return;
      }

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

        if (!previewRef.current) {
          previewRef.current = ReactDOM.createRoot(mountNode);
        }
      }

      if (!previewRef.current) {
        previewRef.current = ReactDOM.createRoot($preview);
      }

      try {
        const module = compileModule(code, { ...baseModules, ...modules });

        if (module.exports.default) {
          const Component = module.exports.default;

          previewRef.current.render(
            <LiveError.Boundary onError={error => setError(error.message)}>
              <QueryClientProvider client={queryClient}>
                <Component
                  {...props}
                  breakpoint={breakpoint}
                  {...(iframe
                    ? { container: iframeRef.current?.contentDocument?.body }
                    : {})}
                />
              </QueryClientProvider>
            </LiveError.Boundary>,
          );
          setError(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'transform error');

        previewRef.current.render(
          <LiveError
            error={e instanceof Error ? e.message : String(e)}
            title="컴파일 오류"
          />,
        );
      }
    },
    [loaded, iframe, previewId, props, breakpoint, modules, setError],
  );

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        const currentRoot = previewRef.current;
        previewRef.current = null;

        requestIdleCallback(() => {
          currentRoot.unmount();
        });
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

    const copyStyles = () => {
      const doc = $iframe.contentDocument;

      if (!doc) {
        return;
      }

      const existingLinks = new Set(
        Array.from(doc.head.querySelectorAll('link[rel="stylesheet"]')).map(
          l => (l as HTMLLinkElement).href,
        ),
      );

      Array.from(
        window.document.querySelectorAll('link[rel="stylesheet"]'),
      ).forEach(link => {
        const href = (link as HTMLLinkElement).href;
        if (!existingLinks.has(href)) {
          const iframeLink = doc.createElement('link');
          iframeLink.rel = 'stylesheet';
          iframeLink.href = href;
          doc.head.appendChild(iframeLink);
          existingLinks.add(href);
        }
      });

      const existingStyles = new Set(
        Array.from(doc.head.querySelectorAll('style')).map(
          style => style.textContent,
        ),
      );

      Array.from(window.document.querySelectorAll('style')).forEach(style => {
        if (!existingStyles.has(style.textContent)) {
          const iframeStyle = doc.createElement('style');
          iframeStyle.textContent = style.textContent;
          doc.head.appendChild(iframeStyle);
          existingStyles.add(style.textContent);
        }
      });
    };

    const onLoad = () => {
      const doc = $iframe.contentDocument;

      if (!doc) {
        return;
      }

      copyStyles();

      if (!scripts.length) {
        setLoaded(true);
        return;
      }

      let loadedCount = 0;
      let hasError = false;

      const normalizeSrc = (src: string) => {
        try {
          return new URL(src, location.origin).href;
        } catch {
          return src;
        }
      };

      const existingScripts = new Set(
        Array.from(doc.head.querySelectorAll('script')).map(s =>
          normalizeSrc(s.src),
        ),
      );

      scripts.forEach(src => {
        if (!existingScripts.has(normalizeSrc(src))) {
          const script = doc.createElement('script');
          script.src = src;
          script.onload = () => {
            loadedCount += 1;
            if (loadedCount === scripts.length && !hasError) {
              setLoaded(true);
            }
          };
          script.onerror = () => {
            hasError = true;
            setLoaded(false);
          };
          doc.head.appendChild(script);
          existingScripts.add(src);
        }
      });

      doc.body.style.overflowX = 'hidden';

      // console.log(doc.head.childNodes.length, 'head nodes in iframe');
    };

    $iframe.addEventListener('load', onLoad);

    const observer = new MutationObserver(() => {
      copyStyles();
    });

    observer.observe(window.document.head, {
      childList: true,
      subtree: true,
    });

    if ($iframe.contentDocument?.readyState === 'complete') {
      onLoad();
    }

    return () => {
      $iframe.removeEventListener('load', onLoad);
      observer.disconnect();
    };
  }, [iframe, scripts]);

  useEffect(() => {
    previewRender(_code || code);
  }, [_code, code, previewRender]);

  return (
    <>
      <div
        ref={elementRef}
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
