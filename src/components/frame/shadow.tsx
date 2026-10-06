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
  // Receives the overlay layer, the `container` to portal a modal or drawer
  // into so it opens inside the preview.
  children: (overlayLayer: HTMLElement | null) => ReactNode;
}

const OVERLAY_LAYER_ATTR = 'data-live-editor-overlay-layer';

// The layer lets clicks through to the preview under it. What is portaled
// into it takes them again.
const OVERLAY_LAYER_STYLE = `[${OVERLAY_LAYER_ATTR}] > * { pointer-events: auto; }`;

// The render target and the overlay layer in one grid cell, so the layer
// covers exactly the preview's box. `min-height: 100%` stretches that box to
// a parent with a set height, such as `Live.Preview`'s, so an overlay isn't
// squeezed into short content. The wrapper isn't positioned, so it doesn't
// change what an `absolute` element in the preview is placed against.
// `isolation` keeps the layer's stacking inside the preview.
const createFrameNodes = () => {
  const wrapper = document.createElement('div');

  wrapper.style.display = 'grid';
  wrapper.style.gridTemplateColumns = 'minmax(0, 1fr)';
  wrapper.style.minHeight = '100%';
  wrapper.style.isolation = 'isolate';

  const renderTarget = document.createElement('div');

  renderTarget.style.gridArea = '1 / 1';

  // `contain: layout` makes the layer the containing block of the fixed
  // elements inside it, so an overlay covers the preview and not the page.
  const overlayLayer = document.createElement('div');

  overlayLayer.setAttribute(OVERLAY_LAYER_ATTR, '');
  overlayLayer.style.gridArea = '1 / 1';
  overlayLayer.style.zIndex = '1';
  overlayLayer.style.contain = 'layout';
  overlayLayer.style.pointerEvents = 'none';

  const style = document.createElement('style');

  style.textContent = OVERLAY_LAYER_STYLE;
  wrapper.append(style, renderTarget, overlayLayer);

  return { wrapper, renderTarget };
};

// The overlay layer `createFrameNodes` put next to `renderTarget`.
const overlayLayerOf = (renderTarget: HTMLElement) => {
  const layer = renderTarget.nextElementSibling;

  return layer instanceof HTMLElement && layer.hasAttribute(OVERLAY_LAYER_ATTR)
    ? layer
    : null;
};

const Shadow = ({ syncStyle = false, children }: Props) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const renderTargetRef = useRef<HTMLDivElement | null>(null);
  const [renderTarget, setRenderTarget] = useState<HTMLDivElement | null>(null);

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

    let shadowRoot = shadowRootRef.current;

    if (!shadowRoot) {
      shadowRoot =
        hostRef.current.shadowRoot ||
        hostRef.current.attachShadow({ mode: 'open' });
      shadowRootRef.current = shadowRoot;
    }

    let target = renderTargetRef.current;

    if (!target) {
      const nodes = createFrameNodes();

      shadowRoot.appendChild(nodes.wrapper);
      target = nodes.renderTarget;
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
      {renderTarget &&
        createPortal(children(overlayLayerOf(renderTarget)), renderTarget)}
    </div>
  );
};

export default Shadow;
