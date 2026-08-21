import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useMutationObserver } from '@jbpark/use-hooks';

interface Props {
  // Clones the host document's <link rel="stylesheet">/<style> tags into the
  // shadow root, mirroring `iframe.tsx`'s option of the same name. Unlike
  // `dynamicTailwind` (which recompiles only the classes it can find in the
  // rendered DOM, and only knows Tailwind's own default theme), this gets
  // the host's *actual* compiled CSS — including a consuming app's own
  // custom utilities/theme tokens — at the cost of only covering classes
  // that were already known at the host's own build time. The two are
  // complementary: this handles anything already in the host's stylesheets,
  // dynamicTailwind covers whatever's left (e.g. a class typed at runtime
  // that no build ever saw).
  syncStyle?: boolean;
  children: (hostContainer: HTMLElement | null) => ReactNode;
}

const Shadow = ({ syncStyle = false, children }: Props) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const renderTargetRef = useRef<HTMLDivElement | null>(null);
  const [renderTarget, setRenderTarget] = useState<HTMLDivElement | null>(null);
  const [hostContainer, setHostContainer] = useState<HTMLElement | null>(null);

  // Appended as siblings of the portal target (below), not inside it — that
  // subtree is React-owned via createPortal, and anything appended there
  // directly would get wiped on the next reconcile.
  const styleManagerRef = useRef<{
    copiedLinks: Set<string>;
    copiedStyles: Set<string>;
  }>({
    copiedLinks: new Set(),
    copiedStyles: new Set(),
  });

  const applyStyle = useCallback(() => {
    const shadowRoot = shadowRootRef.current;

    if (!shadowRoot || !syncStyle) {
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
      const fragment = document.createDocumentFragment();
      newLinks.forEach(href => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        fragment.appendChild(link);
        manager.copiedLinks.add(href);
      });
      shadowRoot.appendChild(fragment);
    }

    const styleTags = document.querySelectorAll<HTMLStyleElement>('style');
    const newStyles = Array.from(styleTags)
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
      const fragment = document.createDocumentFragment();
      newStyles.forEach(content => {
        const style = document.createElement('style');
        style.textContent = content;
        fragment.appendChild(style);
      });
      shadowRoot.appendChild(fragment);
    }
  }, [syncStyle]);

  const applyStyleTimeoutRef = useRef<number>(undefined);

  // Debounced so a burst of head mutations (a stylesheet swap can fire
  // several in quick succession) only re-runs applyStyle once — same
  // rationale as iframe.tsx's identical setup.
  const debouncedApplyStyle = useCallback(() => {
    clearTimeout(applyStyleTimeoutRef.current);
    applyStyleTimeoutRef.current = window.setTimeout(applyStyle, 50);
  }, [applyStyle]);

  useMutationObserver(document.head, debouncedApplyStyle, {
    enabled: syncStyle,
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });

  useLayoutEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const container = hostRef.current.closest(
      '[data-frame-container]',
    ) as HTMLElement | null;

    setHostContainer(container);

    let shadowRoot = shadowRootRef.current;

    if (!shadowRoot) {
      shadowRoot =
        hostRef.current.shadowRoot ||
        hostRef.current.attachShadow({ mode: 'open' });
      shadowRootRef.current = shadowRoot;
    }

    let target = renderTargetRef.current;

    if (!target) {
      target = document.createElement('div');
      shadowRoot.appendChild(target);
      renderTargetRef.current = target;
      setRenderTarget(target);
    }

    applyStyle();
    // click/pointerdown/pointerup are `composed: true` by spec, so they
    // already retarget across the shadow boundary and reach listeners
    // outside it (document, this host's ancestors, React's own root
    // listener) on their own - manually redispatching them here used to
    // make every one of those listeners see the interaction twice. Anyone
    // needing the real element inside the shadow tree (not the retargeted
    // host) can still read it via event.composedPath()[0], unaffected by
    // this removal. See #92.
  }, [applyStyle]);

  useLayoutEffect(() => {
    if (renderTargetRef.current && !renderTarget) {
      setRenderTarget(renderTargetRef.current);
    }
  }, [renderTarget]);

  return (
    <div ref={hostRef} style={{ display: 'contents' }}>
      {renderTarget && createPortal(children(hostContainer), renderTarget)}
    </div>
  );
};

export default Shadow;
