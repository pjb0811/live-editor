import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { getCachedScriptBlob } from '~/utils';

export interface Props {
  title?: string;
  /** Forwarded to the iframe's `sandbox` attribute for DOM/CSS isolation only — not a security boundary, since preview code executes in the host window's realm (see `compileModule` in `~/utils`). */
  sandbox?: string;
  style?: React.CSSProperties;
  scripts?: string[];
  styles?: string[];
  stylesheets?: string[];
  autoHeight?: boolean;
  syncStyle?: boolean;
  children: (container: HTMLElement) => ReactNode;
  onLoaded?: () => void;
}

const EMPTY_STRING_ARRAY: string[] = [];

const IFrame = ({
  title = 'Live Preview',
  sandbox,
  style = {},
  scripts = EMPTY_STRING_ARRAY,
  styles = EMPTY_STRING_ARRAY,
  stylesheets = EMPTY_STRING_ARRAY,
  autoHeight = false,
  syncStyle = false,
  children,
  onLoaded,
  ...props
}: Props) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  // Tracks which script srcs have already been injected into this iframe's
  // document, keyed by src rather than a single loaded/not-loaded boolean —
  // a boolean latched to `true` forever meant a later change to `scripts`
  // (new entries) never got loaded once the first batch had.
  const loadedScriptsRef = useRef<Set<string>>(new Set());
  const prevStyleCountRef = useRef(0);
  const prevStylesheetCountRef = useRef(0);
  const shouldAutoHeight = autoHeight && style.height == null;

  const styleManagerRef = useRef<{
    copiedLinks: Set<string>;
    copiedStyles: Set<string>;
  }>({
    copiedLinks: new Set(),
    copiedStyles: new Set(),
  });

  const applyStyle = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;

    if (!doc || !syncStyle) {
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
      const fragment = doc.createDocumentFragment();
      newLinks.forEach(href => {
        const link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        fragment.appendChild(link);
        manager.copiedLinks.add(href);
      });
      doc.head.appendChild(fragment);
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
      const fragment = doc.createDocumentFragment();
      newStyles.forEach(content => {
        const style = doc.createElement('style');
        style.textContent = content;
        fragment.appendChild(style);
      });
      doc.head.appendChild(fragment);
    }
  }, [syncStyle]);

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

      applyStyle();

      const pendingScripts = scripts.filter(
        src => !loadedScriptsRef.current.has(src),
      );

      if (pendingScripts.length) {
        pendingScripts.forEach(src => loadedScriptsRef.current.add(src));

        Promise.all(pendingScripts.map(getCachedScriptBlob)).then(blobUrls => {
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

    if (syncStyle) {
      observer = new MutationObserver(() => {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(applyStyle, 50);
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
  }, [syncStyle, scripts, onLoaded, applyStyle]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;

    if (!doc?.head) {
      return;
    }

    styles.forEach((css, index) => {
      const styleId = `injected-style-${index}`;
      let styleEl = doc.getElementById(styleId) as HTMLStyleElement | null;

      if (!styleEl) {
        styleEl = doc.createElement('style');
        styleEl.id = styleId;
        doc.head.appendChild(styleEl);
      }

      if (styleEl.textContent !== css) {
        styleEl.textContent = css;
      }
    });

    // Indices beyond the current array's length are stale from a previous,
    // longer `styles`/`stylesheets` — the loops above only add/update up to
    // the current length, so anything past it (from before an item was
    // removed, or the array shrank) would otherwise stay injected forever.
    for (
      let index = styles.length;
      index < prevStyleCountRef.current;
      index++
    ) {
      doc.getElementById(`injected-style-${index}`)?.remove();
    }
    prevStyleCountRef.current = styles.length;

    stylesheets.forEach((href, index) => {
      const linkId = `injected-stylesheet-${index}`;
      let linkEl = doc.getElementById(linkId) as HTMLLinkElement | null;

      if (!linkEl) {
        linkEl = doc.createElement('link');
        linkEl.id = linkId;
        linkEl.rel = 'stylesheet';
        doc.head.appendChild(linkEl);
      }

      if (linkEl.href !== href) {
        linkEl.href = href;
      }
    });

    for (
      let index = stylesheets.length;
      index < prevStylesheetCountRef.current;
      index++
    ) {
      doc.getElementById(`injected-stylesheet-${index}`)?.remove();
    }
    prevStylesheetCountRef.current = stylesheets.length;
  }, [styles, stylesheets]);

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

      const doc = iframe.contentDocument;
      const win = doc?.defaultView;

      const popups = mountNode.querySelectorAll<HTMLElement>(
        '[data-floating-ui-focusable]',
      );

      popups.forEach(popup => {
        if (popup.offsetHeight > 0) {
          let offsetY = 0;

          const transform = popup.style.transform;
          if (transform) {
            const match = transform.match(
              /translate\([^,]+,\s*([+-]?\d+(?:\.\d+)?)/,
            );
            if (match?.[1]) {
              offsetY = parseFloat(match[1]);
            }
          }

          const estimatedHeight = offsetY + popup.offsetHeight;
          childrenHeight = Math.max(childrenHeight, estimatedHeight);
        }
      });

      if (win) {
        Array.from(mountNode.children).forEach(child => {
          const el = child as HTMLElement;
          const style = win.getComputedStyle(el);

          if (style.position === 'fixed' || style.position === 'absolute') {
            if (el.offsetHeight > 0) {
              let offsetY = 0;

              const transform = el.style.transform;
              if (transform) {
                const match = transform.match(
                  /translate\([^,]+,\s*([+-]?\d+(?:\.\d+)?)/,
                );
                if (match?.[1]) {
                  offsetY = parseFloat(match[1]);
                }
              }

              const estimatedHeight = offsetY + el.offsetHeight;
              childrenHeight = Math.max(childrenHeight, estimatedHeight);
            }
          }
        });
      }

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
