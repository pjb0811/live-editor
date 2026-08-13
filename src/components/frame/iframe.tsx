import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useMutationObserver, useResizeObserver } from '@jbpark/use-hooks';

import { getCachedScriptBlob } from '~/utils';

import {
  FALLBACK_PROBE_HEIGHT,
  computeProbeHeight,
  estimatePositionedElementHeight,
  isVisuallyHidden,
} from './measure';
import { convertViewportUnits } from './viewport-units';

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
        // Host styles can legitimately use vh/svh/etc themselves (e.g. a
        // shared design-system stylesheet) — converted the same way as
        // the styles/stylesheets props below, so they resolve against
        // the preview's own probe height instead of the iframe's, once
        // autoHeight's container context (see ensureContainerStyle) is
        // active.
        style.textContent = convertViewportUnits(content);
        fragment.appendChild(style);
      });
      doc.head.appendChild(fragment);
    }
  }, [syncStyle]);

  const applyStyleTimeoutRef = useRef<number>(undefined);

  // Debounced so a burst of head mutations (a stylesheet swap can fire
  // several in quick succession) only re-runs applyStyle once, matching the
  // original raw-MutationObserver setup's 50ms debounce.
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
    attributeFilter: ['href'],
  });

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

    if ($iframe.contentDocument?.readyState === 'complete') {
      onLoad();
    }

    return () => {
      $iframe.removeEventListener('load', onLoad);
    };
  }, [scripts, onLoaded, applyStyle]);

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

      // The primary source of vh/svh/etc in a real preview — compiled
      // component CSS (e.g. Tailwind's `h-screen` -> `height: 100vh`).
      // See ensureContainerStyle below for why this needs converting.
      const convertedCss = convertViewportUnits(css);

      if (styleEl.textContent !== convertedCss) {
        styleEl.textContent = convertedCss;
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

  // The <html> element's own container-context style — id'd so it can be
  // found/updated/removed across calls without holding a ref to it. Scoped
  // to `html` (not `:root`, which is equivalent but the fork's own
  // convention) so this only ever affects cq*-unit resolution and nothing
  // else about the document.
  const CONTAINER_STYLE_ID = 'autoheight-container';

  // Ties `cqh`/`cqmin`/`cqmax` (what convertViewportUnits rewrote every
  // vh/svh/lvh/dvh/vmin/vmax to) to a *fixed* reference height instead of
  // the iframe's own height — this is what breaks the old approach's
  // circularity (#132 problem 1): folding the iframe to 0px before
  // measuring made vh-sized content resolve to 0 and stay there forever,
  // while measuring without folding never converges (vh content sized
  // against the iframe's own just-grown height keeps growing it further).
  // `container-type: size` requires an explicit height to size against,
  // which `probeHeight` (the *scroll container's* available height, not
  // the iframe's) provides — genuinely independent of whatever height this
  // function goes on to set on the iframe itself.
  const ensureContainerStyle = (doc: Document, probeHeight: number) => {
    let styleEl = doc.getElementById(
      CONTAINER_STYLE_ID,
    ) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = CONTAINER_STYLE_ID;
      doc.head?.appendChild(styleEl);
    }

    styleEl.textContent = `html { container-type: size !important; height: ${probeHeight}px !important; }`;
  };

  // A second, separate style — inert (`media="not all"`) except for the
  // brief window updateHeight actually measures in, toggled on right
  // before and off right after (#132 stage 4). Two things it guards
  // against:
  //
  // - transitions: if any rule in the preview (or a browser default)
  //   gives `html`/an ancestor a `transition` on a property this
  //   measurement touches, changing ensureContainerStyle's `height` would
  //   animate instead of applying instantly, and a read taken right after
  //   would catch a mid-transition value instead of the settled one.
  // - scrollbar chrome: applying a new probe height can make a scrollbar
  //   appear/disappear for exactly this measurement pass; on platforms
  //   where it takes up layout width (Windows, unlike macOS's overlay
  //   scrollbars), that narrows content and skews the height reading.
  //   `scrollbar-width: none`/`::-webkit-scrollbar { display: none }`
  //   only hides the *chrome* — unlike `overflow: hidden`, scrolling
  //   itself still works, so content that ends up taller than its probe
  //   height is still reachable rather than silently clipped.
  //
  // A single style element (not two, and never added/removed) so
  // toggling it can't itself trip the MutationObserver watching for
  // *content* changes.
  const MEASUREMENT_OVERRIDE_STYLE_ID = 'autoheight-measurement-overrides';

  const withMeasurementOverrides = (doc: Document, measure: () => void) => {
    let styleEl = doc.getElementById(
      MEASUREMENT_OVERRIDE_STYLE_ID,
    ) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = MEASUREMENT_OVERRIDE_STYLE_ID;
      styleEl.media = 'not all';
      styleEl.textContent = [
        '*, *::before, *::after { transition: none !important; }',
        'html, body { scrollbar-width: none !important; }',
        'html::-webkit-scrollbar, body::-webkit-scrollbar { display: none !important; }',
      ].join('\n');
      doc.head?.appendChild(styleEl);
    }

    styleEl.media = 'all';
    measure();
    styleEl.media = 'not all';
  };

  // Not ported from #132 stage 4: a "settled scrollHeight + settled probe
  // height both unchanged -> skip" guard, meant to avoid redundant re-runs
  // from updateHeight's own `iframe.style.height` write looping back
  // through the ResizeObserver below (a real path — the iframe's own box
  // size determines its *internal* viewport size, so this can genuinely
  // fire again). Left out deliberately: `scrollHeight` only reflects
  // normal document flow, but a position:fixed/absolute overlay opening or
  // closing (its whole reason for needing the full-subtree walk above)
  // often doesn't touch `scrollHeight` at all. A guard keyed on it would
  // silently skip exactly the kind of update stage 3 exists to catch —
  // reintroducing a narrower version of the bug this file just fixed
  // would be a worse trade than the redundant-recompute cost it'd save.
  const updateHeight = useCallback(() => {
    if (!shouldAutoHeight || !mountNode || !iframeRef.current) {
      return;
    }

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument;
    const win = doc?.defaultView;

    if (!doc || !win) {
      return;
    }

    const scrollParent = iframe.closest<HTMLElement>('[data-frame-container]');

    let probeHeight: number;

    if (!scrollParent) {
      // No scroll container anywhere in the tree (Frame used directly,
      // without Dnd) — fall back to a fixed default; see
      // FALLBACK_PROBE_HEIGHT's own comment for why this differs from
      // the "container exists but isn't laid out yet" case below.
      probeHeight = FALLBACK_PROBE_HEIGHT;
    } else {
      let wrapperInsets = 0;
      let node = iframe.parentElement;

      while (node && node !== scrollParent) {
        const style = win.getComputedStyle(node);

        wrapperInsets +=
          parseFloat(style.borderTopWidth) +
          parseFloat(style.borderBottomWidth) +
          parseFloat(style.paddingTop) +
          parseFloat(style.paddingBottom);

        node = node.parentElement;
      }

      const computed = computeProbeHeight(
        scrollParent.clientHeight,
        wrapperInsets,
      );

      if (computed === null) {
        // Layout not ready yet (mid-transition, just mounted, etc) —
        // skip this pass instead of guessing; the ResizeObserver/
        // MutationObserver below will call this again once something
        // actually changes, including the layout settling.
        return;
      }

      probeHeight = computed;
    }

    let contentHeight = 0;

    withMeasurementOverrides(doc, () => {
      ensureContainerStyle(doc, probeHeight);

      // No 0px fold before measuring (that was the source of problem 1)
      // — with cq*-unit content now sized against the fixed probe height
      // instead of the iframe's own, a direct read is already stable.
      contentHeight = mountNode.scrollHeight;

      // Full subtree, not just direct children (a popup/overlay nested a
      // few components deep was previously invisible to this walk
      // entirely — problem 2's "중첩된 오버레이는 아예 누락됩니다").
      const descendants = mountNode.querySelectorAll<HTMLElement>('*');

      descendants.forEach(el => {
        const style = win.getComputedStyle(el);

        // visibility:hidden/opacity:0 elements (a closed bottom sheet,
        // a not-yet-faded-in overlay) keep a non-zero offsetHeight —
        // display:none doesn't need checking here since the browser
        // already zeroes *its* offsetHeight on its own.
        if (isVisuallyHidden(style)) {
          return;
        }

        if (
          (style.position === 'fixed' || style.position === 'absolute') &&
          el.offsetHeight > 0
        ) {
          const estimatedHeight = estimatePositionedElementHeight(
            el.offsetHeight,
            style.transform,
            probeHeight,
          );

          contentHeight = Math.max(contentHeight, estimatedHeight);
        }
      });
    });

    if (contentHeight > 0) {
      iframe.style.height = `${Math.ceil(contentHeight)}px`;
    }
  }, [shouldAutoHeight, mountNode]);

  // updateHeight only ever adds/refreshes the container-context style —
  // if autoHeight is toggled off (or an explicit style.height is passed)
  // at runtime, nothing else would ever remove or update it again,
  // leaving cq*-unit content sized against a stale probe height instead
  // of correctly falling back to real viewport-relative sizing (which
  // cqh does on its own once nothing establishes a size container — see
  // ensureContainerStyle's own comment).
  useEffect(() => {
    if (shouldAutoHeight) {
      return;
    }

    iframeRef.current?.contentDocument
      ?.getElementById(CONTAINER_STYLE_ID)
      ?.remove();
  }, [shouldAutoHeight]);

  useEffect(() => {
    updateHeight();
  }, [updateHeight]);

  const [resizeRef, resizeSize] = useResizeObserver<HTMLElement>();

  // useResizeObserver's ref callback isn't wired through this component's
  // own JSX (mountNode is the portal's imperatively-created container, not
  // something rendered here), so it's attached/detached imperatively
  // instead. Its reported size is intentionally unused - updateHeight's own
  // walk (every descendant, position:fixed/absolute ones capped and offset
  // by their transform) computes a more accurate height than mountNode's
  // own content-box size would, so a change in `resizeSize` is only used
  // as a trigger to recompute.
  useEffect(() => {
    if (!shouldAutoHeight || !mountNode) {
      return;
    }

    resizeRef(mountNode);
    return () => resizeRef(null);
  }, [shouldAutoHeight, mountNode, resizeRef]);

  useEffect(() => {
    updateHeight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizeSize]);

  useMutationObserver(mountNode, updateHeight, {
    enabled: shouldAutoHeight,
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });

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
