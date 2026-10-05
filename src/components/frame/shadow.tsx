import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useMutationObserver } from '@jbpark/use-hooks';

import { createStyleSyncManager, reconcileStyles } from './style-sync';

interface Props {
  // Copies the host page's stylesheets and `<style>` tags into the shadow
  // root, like `iframe.tsx`'s option of the same name. This brings the host's
  // compiled CSS, its own utilities and theme included. `dynamicTailwind`
  // covers what the host's build never saw, such as a class typed at runtime.
  syncStyle?: boolean;
  children: (hostContainer: HTMLElement | null) => ReactNode;
}

const Shadow = ({ syncStyle = false, children }: Props) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const renderTargetRef = useRef<HTMLDivElement | null>(null);
  const [renderTarget, setRenderTarget] = useState<HTMLDivElement | null>(null);
  const [hostContainer, setHostContainer] = useState<HTMLElement | null>(null);

  // Added next to the portal target, not inside it: React owns that subtree
  // and would remove anything added there.
  const styleManagerRef = useRef(createStyleSyncManager());

  const applyStyle = useCallback(() => {
    const shadowRoot = shadowRootRef.current;

    if (!shadowRoot) {
      return;
    }

    reconcileStyles(document, shadowRoot, styleManagerRef.current, syncStyle);
  }, [syncStyle]);

  const applyStyleTimeoutRef = useRef<number>(undefined);

  // Debounced, since a stylesheet swap fires several head mutations in a
  // row, as in `iframe.tsx`.
  const debouncedApplyStyle = useCallback(() => {
    clearTimeout(applyStyleTimeoutRef.current);
    applyStyleTimeoutRef.current = window.setTimeout(applyStyle, 50);
  }, [applyStyle]);

  useEffect(() => {
    return () => clearTimeout(applyStyleTimeoutRef.current);
  }, []);

  useMutationObserver(document.head, debouncedApplyStyle, {
    enabled: syncStyle,
    childList: true,
    subtree: true,
    attributes: true,
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
    // `click`, `pointerdown` and `pointerup` already cross the shadow boundary
    // (`composed: true`), so they aren't dispatched again here, which made
    // listeners outside see them twice (#92). `event.composedPath()[0]` gives
    // the element inside.
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
