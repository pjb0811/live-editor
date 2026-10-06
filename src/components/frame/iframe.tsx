import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import {
  useEventListener,
  useMutationObserver,
  useResizeObserver,
} from '@jbpark/use-hooks';

import { withScriptBlobs } from '~/utils/scripts';

import {
  FALLBACK_PROBE_HEIGHT,
  computeProbeHeight,
  isAnimationActive,
  isVisuallyHidden,
  positionedElementBottom,
  verticalInsets,
} from './measure';
import {
  createRootAttributeSync,
  createStyleSyncManager,
  reconcileRootAttributes,
  reconcileStyles,
} from './style-sync';
import {
  convertViewportUnits,
  rewriteInlineViewportUnits,
} from './viewport-units';

// The style that makes `<html>` a size container, found again by this id.
// Scoped to `html`, so it only affects how `cq*` units resolve.
const CONTAINER_STYLE_ID = 'autoheight-container';

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

// `getAnimations()` mixes CSS animations, CSS transitions and script
// animations (`element.animate()`). Only the first two fire a bubbling event
// when they end, so they're told apart. Both constructors are checked first,
// since jsdom has neither.
const isCssAnimation = (
  win: Window & typeof globalThis,
  animation: Animation,
): boolean =>
  typeof win.CSSAnimation === 'function' &&
  animation instanceof win.CSSAnimation;

const isCssTransition = (
  win: Window & typeof globalThis,
  animation: Animation,
): boolean =>
  typeof win.CSSTransition === 'function' &&
  animation instanceof win.CSSTransition;

// Whether the element is animating, which tells a passing `opacity: 0` (the
// start of a fade-in, so measure it) from a lasting one (a closed overlay, so
// skip it). Transitions count too: a measurement pass doesn't always freeze
// them, so a fade-in can read `opacity: 0` with a transition running. Without
// `getAnimations()` (jsdom, old browsers) this is false, which under-measures
// a fading-in overlay rather than counting a closed one.
const hasActiveAnimation = (el: HTMLElement): boolean =>
  typeof el.getAnimations === 'function' &&
  el.getAnimations().some(animation => isAnimationActive(animation.playState));

// An animation that repeats forever never resolves `finished`, so it gets no
// handler. It's always animating, so `hasActiveAnimation` keeps it measured
// anyway.
const neverFinishes = (animation: Animation): boolean => {
  const timing = animation.effect?.getComputedTiming();

  return timing?.iterations === Infinity || timing?.duration === Infinity;
};

// A style that is off (`media="not all"`) except while a measurement runs.
// It guards against two things:
//
// - Transitions: a transition on what the measurement changes would animate
//   the new probe height, and the read would catch a value part-way there.
//   Only on a pass that changes the probe height (`freezeTransitions`).
// - Scrollbars: a new probe height can show or hide a scrollbar for that
//   pass, which narrows the content where scrollbars take space (Windows)
//   and changes the height. Only the scrollbar is hidden; scrolling still
//   works.
//
// One element that is never added or removed, so toggling it doesn't trigger
// the MutationObserver that watches the content.
const MEASUREMENT_OVERRIDE_STYLE_ID = 'autoheight-measurement-overrides';

const SCROLLBAR_OVERRIDE_RULES = [
  'html, body { scrollbar-width: none !important; }',
  'html::-webkit-scrollbar, body::-webkit-scrollbar { display: none !important; }',
];

const FREEZE_TRANSITIONS_RULE =
  '*, *::before, *::after { transition: none !important; }';

// Measures with the overrides above on. `freezeTransitions` is off unless
// the pass changes the probe height: `transition: none` cancels a running
// transition rather than pausing it, and the element jumps to its end state
// for good. A pass that leaves the probe height alone changes nothing, so it
// leaves the preview's transitions alone.
const withMeasurementOverrides = (
  doc: Document,
  freezeTransitions: boolean,
  measure: () => void,
) => {
  let styleEl = doc.getElementById(
    MEASUREMENT_OVERRIDE_STYLE_ID,
  ) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = MEASUREMENT_OVERRIDE_STYLE_ID;
    styleEl.media = 'not all';
    doc.head?.appendChild(styleEl);
  }

  const text = (
    freezeTransitions
      ? [FREEZE_TRANSITIONS_RULE, ...SCROLLBAR_OVERRIDE_RULES]
      : SCROLLBAR_OVERRIDE_RULES
  ).join('\n');

  if (styleEl.textContent !== text) {
    styleEl.textContent = text;
  }

  styleEl.media = 'all';
  measure();
  styleEl.media = 'not all';
};

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
  // The script srcs already added to this iframe's document, so a src added
  // to `scripts` later still loads.
  const loadedScriptsRef = useRef<Set<string>>(new Set());
  // The document those scripts went into. Moving the iframe, as reordering
  // canvas sections does, reloads it with a new document that has none
  // (#507).
  const loadedScriptsDocRef = useRef<Document | null>(null);
  const prevStyleCountRef = useRef(0);
  const prevStylesheetCountRef = useRef(0);
  // Animations that already have a re-measure handler, so a long one gets only
  // one. Weak, so it never keeps an animation or its element alive.
  const trackedAnimationsRef = useRef(new WeakSet<Animation>());
  // Lets those handlers call the current `updateHeight` without it depending
  // on itself.
  const updateHeightRef = useRef<(() => void) | null>(null);
  // The probe height the container style was last built for. A pass that
  // leaves it unchanged changes nothing, so it can measure without freezing
  // transitions.
  const lastProbeHeightRef = useRef<number | undefined>(undefined);
  const shouldAutoHeight = autoHeight && style.height == null;

  const styleManagerRef = useRef(createStyleSyncManager());
  const rootAttributeSyncRef = useRef(createRootAttributeSync());

  const applyStyle = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;

    if (!doc) {
      return;
    }

    // The container style goes after every copied host style. Both use
    // `!important`, so a host `html { height: 100% !important }` copied in after
    // it would win and fold the frame to a pixel (#441).
    reconcileStyles(
      document,
      doc,
      styleManagerRef.current,
      syncStyle,
      convertViewportUnits,
      doc.getElementById(CONTAINER_STYLE_ID),
    );
    // The host's theme class or attribute, which the copied styles select on
    // (#497).
    reconcileRootAttributes(
      document.documentElement,
      doc.documentElement,
      rootAttributeSyncRef.current,
      syncStyle,
    );
  }, [syncStyle]);

  const applyStyleTimeoutRef = useRef<number>(undefined);

  // Debounced, since a stylesheet swap fires several head mutations in a
  // row.
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

  // A theme switch only changes the host's `<html>` attributes, which the head
  // observer above doesn't see.
  useMutationObserver(document.documentElement, debouncedApplyStyle, {
    enabled: syncStyle,
    attributes: true,
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

      if (loadedScriptsDocRef.current !== doc) {
        loadedScriptsDocRef.current = doc;
        loadedScriptsRef.current = new Set();
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

        withScriptBlobs(pendingScripts, blobUrls => {
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

      // The main source of `vh` units in a preview: compiled component CSS,
      // such as Tailwind's `h-screen`. See `ensureContainerStyle` for why they're
      // converted.
      const convertedCss = convertViewportUnits(css);

      if (styleEl.textContent !== convertedCss) {
        styleEl.textContent = convertedCss;
      }
    });

    // Remove what's left from a longer `styles` or `stylesheets` array.
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

  // Hides the iframe document's scrollbar while `autoHeight` sizes it.
  // Rounding can leave the document a fraction taller than the iframe, which
  // would draw a scrollbar in every section. Unlike the measurement override,
  // this stays on. Scrolling still works if the content ever outgrows it.
  const HIDE_SCROLLBAR_STYLE_ID = 'autoheight-hide-scrollbar';

  // Makes `<html>` a size container with a fixed height, `probeHeight`, the
  // scroll container's available height. Viewport units are rewritten to `cq*`
  // units (`convertViewportUnits`), so they resolve against this height
  // instead of the iframe's own. Against the iframe's own height, `100vh`
  // content would grow the iframe, which grows the content again, and never
  // settle (#132).
  const ensureContainerStyle = (doc: Document, probeHeight: number) => {
    let styleEl = doc.getElementById(
      CONTAINER_STYLE_ID,
    ) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = CONTAINER_STYLE_ID;
      doc.head?.appendChild(styleEl);
    }

    const text = `html { container-type: size !important; height: ${probeHeight}px !important; }`;

    // Written only when it differs, so a pass with the same probe height
    // changes nothing in the document (see `freezeTransitions`).
    if (styleEl.textContent !== text) {
      styleEl.textContent = text;
    }
  };

  // Script animations fire no event when they end, so each gets one
  // re-measure when its `finished` promise settles. CSS animations and
  // transitions are skipped: their end events already bubble to the mount node.
  // A cancelled animation rejects `finished` and snaps the element back, which
  // also changes the height, so both outcomes re-measure.
  const trackScriptAnimations = useCallback(
    (doc: Document, win: Window & typeof globalThis) => {
      if (typeof doc.getAnimations !== 'function') {
        return;
      }

      doc.getAnimations().forEach(animation => {
        if (
          trackedAnimationsRef.current.has(animation) ||
          !isAnimationActive(animation.playState) ||
          isCssAnimation(win, animation) ||
          isCssTransition(win, animation) ||
          neverFinishes(animation)
        ) {
          return;
        }

        trackedAnimationsRef.current.add(animation);

        animation.finished
          .catch(() => undefined)
          .then(() => updateHeightRef.current?.());
      });
    },
    [],
  );

  // There is no "skip when `scrollHeight` and the probe height are unchanged"
  // check, though setting the iframe's height can trigger the ResizeObserver
  // again. Opening or closing a fixed or absolute overlay often leaves
  // `scrollHeight` unchanged, so such a check would skip exactly the updates
  // the full-subtree walk is for.
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
      // No scroll container (`Frame` used without `Live.Dnd`): use a fixed
      // default. See `FALLBACK_PROBE_HEIGHT`.
      probeHeight = FALLBACK_PROBE_HEIGHT;
    } else {
      // From the iframe up to the scroll container: the iframe's and each
      // wrapper's margin, border and padding take space, and the scroll container
      // adds only its padding, since `clientHeight` leaves out its border and
      // margin (#440).
      const scrollParentStyle = win.getComputedStyle(scrollParent);
      let wrapperInsets =
        (parseFloat(scrollParentStyle.paddingTop) || 0) +
        (parseFloat(scrollParentStyle.paddingBottom) || 0);
      let node: HTMLElement | null = iframe;

      while (node && node !== scrollParent) {
        wrapperInsets += verticalInsets(win.getComputedStyle(node));
        node = node.parentElement;
      }

      const computed = computeProbeHeight(
        scrollParent.clientHeight,
        wrapperInsets,
      );

      if (computed === null) {
        // Layout isn't ready yet: skip this pass. The observers call this again
        // once it settles.
        return;
      }

      probeHeight = computed;
    }

    let contentHeight = 0;

    // Only the first pass and a pass that moves the probe height change the
    // container, so only they freeze transitions.
    const freezeTransitions = probeHeight !== lastProbeHeightRef.current;

    lastProbeHeightRef.current = probeHeight;

    // Sizes the iframe's viewport to the probe height for the reads below, so
    // a fixed element's percentage `height` or `top` resolves against what the
    // section shows, not against the iframe's current height, which is itself
    // what is being measured (#565). The final height replaces it before the
    // next paint.
    const previousHeight = iframe.style.height;

    iframe.style.height = `${probeHeight}px`;

    withMeasurementOverrides(doc, freezeTransitions, () => {
      ensureContainerStyle(doc, probeHeight);

      // Rewrite viewport units in inline `style` attributes and in-preview
      // `<style>` tags, which the container style can't reach, so they resolve
      // against the probe height too. After `ensureContainerStyle` and before the
      // reads below. It's idempotent, so the observer pass its own rewrites trigger
      // changes nothing.
      rewriteInlineViewportUnits(mountNode);

      // No need to fold the iframe to 0px first: `cq*` content is sized against
      // the fixed probe height, so a direct read is stable (#132).
      contentHeight = mountNode.scrollHeight;

      // Every descendant, so an overlay nested deep in the tree counts too.
      const descendants = mountNode.querySelectorAll<HTMLElement>('*');

      descendants.forEach(el => {
        const style = win.getComputedStyle(el);

        // `visibility: hidden` and `opacity: 0` elements, such as a closed bottom
        // sheet, still have an `offsetHeight`, so they're skipped here
        // (`display: none` already reads 0). Animations are checked only for a fully
        // transparent element, to tell a fade-in apart from a hidden one.
        const isAnimating = style.opacity === '0' && hasActiveAnimation(el);

        if (isVisuallyHidden(style, isAnimating)) {
          return;
        }

        if (
          (style.position === 'fixed' || style.position === 'absolute') &&
          el.offsetHeight > 0
        ) {
          const rect = el.getBoundingClientRect();
          const bottom = positionedElementBottom(
            rect.top,
            rect.bottom,
            probeHeight,
          );

          if (bottom !== null) {
            contentHeight = Math.max(contentHeight, bottom);
          }
        }
      });
    });

    iframe.style.height =
      contentHeight > 0 ? `${Math.ceil(contentHeight)}px` : previousHeight;

    // After the measurement window, which can cancel transitions, so this sees
    // the document's real animations.
    trackScriptAnimations(doc, win);
  }, [shouldAutoHeight, mountNode, trackScriptAnimations]);

  useEffect(() => {
    updateHeightRef.current = updateHeight;
  }, [updateHeight]);

  // Removes the container style when `autoHeight` turns off or a height is
  // given, so `cq*` content goes back to sizing against the viewport.
  useEffect(() => {
    if (shouldAutoHeight) {
      return;
    }

    iframeRef.current?.contentDocument
      ?.getElementById(CONTAINER_STYLE_ID)
      ?.remove();
  }, [shouldAutoHeight]);

  // A fixed-height iframe scrolls its own document. A copied host
  // `body { overflow: hidden }` would stop that, so an inline value overrides
  // it. With `autoHeight` there's nothing to scroll, so the body is left
  // alone.
  useEffect(() => {
    const body = iframeRef.current?.contentDocument?.body;

    if (!body || !mountNode) {
      return;
    }

    if (shouldAutoHeight) {
      body.style.removeProperty('overflow-y');
    } else {
      body.style.setProperty('overflow-y', 'auto');
    }
  }, [shouldAutoHeight, mountNode]);

  // Depends on `mountNode` so it runs again once the iframe's document
  // exists.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;

    if (!doc?.head) {
      return;
    }

    const existing = doc.getElementById(HIDE_SCROLLBAR_STYLE_ID);

    if (!shouldAutoHeight) {
      existing?.remove();
      return;
    }

    if (existing) {
      return;
    }

    const styleEl = doc.createElement('style');
    styleEl.id = HIDE_SCROLLBAR_STYLE_ID;
    styleEl.textContent = [
      'html, body { scrollbar-width: none !important; }',
      'html::-webkit-scrollbar, body::-webkit-scrollbar { display: none !important; }',
    ].join('\n');
    doc.head.appendChild(styleEl);
  }, [shouldAutoHeight, mountNode]);

  useEffect(() => {
    updateHeight();
  }, [updateHeight]);

  const [resizeRef, resizeSize] = useResizeObserver<HTMLElement>();

  // Attached by hand, since `mountNode` is created by the portal, not
  // rendered here. Only used as a trigger: `updateHeight`'s own walk measures
  // more accurately than the mount node's size.
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

  // Re-measure when an animation or transition ends or is cancelled, which
  // neither observer sees. A fixed or absolute element read part-way through a
  // fade would otherwise keep its height until something else changed (#374).
  // All four events bubble, so one listener each on the mount node covers
  // every descendant.
  //
  // The mount node is wrapped in a ref that changes only with the node, and
  // `enabled` waits until it exists.
  const mountNodeRef = useMemo(() => ({ current: mountNode }), [mountNode]);
  const settleListenerEnabled = shouldAutoHeight && mountNode !== null;

  useEventListener('animationend', updateHeight, {
    target: mountNodeRef,
    enabled: settleListenerEnabled,
  });

  useEventListener('animationcancel', updateHeight, {
    target: mountNodeRef,
    enabled: settleListenerEnabled,
  });

  useEventListener('transitionend', updateHeight, {
    target: mountNodeRef,
    enabled: settleListenerEnabled,
  });

  useEventListener('transitioncancel', updateHeight, {
    target: mountNodeRef,
    enabled: settleListenerEnabled,
  });

  const content = mountNode
    ? createPortal(children(mountNode), mountNode)
    : null;

  return (
    <iframe
      ref={iframeRef}
      style={{
        // An iframe is inline by default and leaves a gap below it for text
        // descenders, which added up across canvas sections (#439).
        display: 'block',
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
