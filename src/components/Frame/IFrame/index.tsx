import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { getCachedScriptBlob } from '~/utils';

export interface Props {
  title?: string;
  sandbox?: string;
  style?: React.CSSProperties;
  scripts?: string[];
  autoHeight?: boolean;
  children: (container: HTMLElement) => ReactNode;
  onLoaded?: () => void;
  onCopyStyles?: (doc: Document) => void;
}

const IFrame = ({
  title = 'Live Preview',
  sandbox,
  style = {},
  scripts = [],
  autoHeight = false,
  children,
  onLoaded,
  onCopyStyles,
  ...props
}: Props) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const scriptsLoadedRef = useRef<boolean>(false);
  const shouldAutoHeight = autoHeight && style.height == null;

  const copyStyles = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;

    if (!doc || !onCopyStyles) {
      return;
    }

    onCopyStyles(doc);
  }, [onCopyStyles]);

  useEffect(() => {
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
      doc.body.style.margin = '0';

      let node = doc.getElementById('iframe-root');

      if (!node) {
        node = doc.createElement('div');
        node.id = 'iframe-root';
        doc.body.appendChild(node);
      }

      setMountNode(node);

      copyStyles();

      if (scripts.length && !scriptsLoadedRef.current) {
        scriptsLoadedRef.current = true;

        Promise.all(scripts.map(getCachedScriptBlob)).then(blobUrls => {
          if (!doc.head) {
            return;
          }

          const fragment = doc.createDocumentFragment();
          blobUrls.forEach(blobUrl => {
            const script = doc.createElement('script');
            script.src = blobUrl;
            fragment.appendChild(script);
          });
          doc.head.appendChild(fragment);
        });
      }

      onLoaded?.();
    };

    $iframe.addEventListener('load', onLoad);

    let timeoutId: number;
    let observer: MutationObserver | null = null;

    if (onCopyStyles) {
      observer = new MutationObserver(() => {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(copyStyles, 50);
      });

      observer.observe(document.head, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href'],
      });
    }

    if ($iframe.contentDocument?.readyState === 'complete') {
      onLoad();
    }

    return () => {
      $iframe.removeEventListener('load', onLoad);
      observer?.disconnect();
      clearTimeout(timeoutId);
    };
  }, [copyStyles, onLoaded, onCopyStyles, scripts]);

  useEffect(() => {
    if (!shouldAutoHeight || !mountNode || !iframeRef.current) {
      return;
    }

    const iframe = iframeRef.current;

    const updateHeight = () => {
      const scrollParent = iframe.closest(
        '[data-frame-container]',
      ) as HTMLElement | null;
      const savedScrollTop = scrollParent?.scrollTop ?? 0;

      iframe.style.height = '0px';

      let childrenHeight = 0;

      Array.from(mountNode.children).forEach(child => {
        const el = child as HTMLElement;
        childrenHeight = Math.max(childrenHeight, el.scrollHeight);
      });

      const contentHeight = Math.max(mountNode.scrollHeight, childrenHeight);

      if (contentHeight > 0) {
        iframe.style.height = `${Math.ceil(contentHeight)}px`;
      }

      if (scrollParent) {
        scrollParent.scrollTop = savedScrollTop;
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(mountNode);

    const mutationObserver = new MutationObserver(updateHeight);
    mutationObserver.observe(mountNode, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [mountNode, shouldAutoHeight]);

  const content = mountNode
    ? createPortal(children(mountNode), mountNode)
    : null;

  return (
    <iframe
      ref={iframeRef}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        ...style,
      }}
      title={title}
      sandbox={sandbox}
      {...props}
    >
      {content}
    </iframe>
  );
};

export default IFrame;
