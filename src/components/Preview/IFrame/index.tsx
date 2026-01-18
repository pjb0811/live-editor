import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  id?: string;
  title?: string;
  sandbox?: string;
  style?: React.CSSProperties;
  scripts?: string[];
  children: (container: HTMLElement) => ReactNode;
  onLoaded?: () => void;
  onCopyStyles?: (doc: Document) => void;
}

const IFrame = ({
  id = 'live-preview',
  title = 'Live Preview',
  sandbox,
  style = {},
  scripts = [],
  children,
  onLoaded,
  onCopyStyles,
}: Props) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [iframeDoc, setIframeDoc] = useState<Document | null>(null);

  const styleManagerRef = useRef<{
    copiedLinks: Set<string>;
    copiedStyles: Set<string>;
  }>({
    copiedLinks: new Set(),
    copiedStyles: new Set(),
  });

  const copyStyles = useCallback(() => {
    if (!iframeDoc) {
      return;
    }

    if (onCopyStyles) {
      onCopyStyles(iframeDoc);
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
      const fragment = iframeDoc.createDocumentFragment();
      newLinks.forEach(href => {
        const link = iframeDoc.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        fragment.appendChild(link);
        manager.copiedLinks.add(href);
      });
      iframeDoc.head.appendChild(fragment);
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
      const fragment = iframeDoc.createDocumentFragment();
      newStyles.forEach(content => {
        const style = iframeDoc.createElement('style');
        style.textContent = content;
        fragment.appendChild(style);
      });
      iframeDoc.head.appendChild(fragment);
    }
  }, [iframeDoc, onCopyStyles]);

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

      let node = doc.getElementById('iframe-root');

      if (!node) {
        node = doc.createElement('div');
        node.id = 'iframe-root';
        doc.body.appendChild(node);
      }

      setIframeDoc(doc);
      setMountNode(node);

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

      onLoaded?.();
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
  }, [scripts, copyStyles, onLoaded]);

  const content =
    mountNode && iframeDoc
      ? createPortal(children(mountNode), mountNode)
      : null;

  return (
    <iframe
      id={id}
      ref={iframeRef}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        ...style,
      }}
      title={title}
      sandbox={sandbox}
    >
      {content}
    </iframe>
  );
};

export default IFrame;
