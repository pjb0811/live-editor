import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import {
  useEventListener,
  useMutationObserver,
  useResizeObserver,
} from '@jbpark/use-hooks';

import { getCachedScriptBlob } from '~/utils';

import {
  FALLBACK_PROBE_HEIGHT,
  computeProbeHeight,
  estimatePositionedElementHeight,
  isAnimationActive,
  isVisuallyHidden,
} from './measure';
import { createStyleSyncManager, reconcileStyles } from './style-sync';
import {
  convertViewportUnits,
  rewriteInlineViewportUnits,
} from './viewport-units';

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

// `getAnimations()` returns three kinds of animation mixed together:
// CSSAnimation (a @keyframes rule), CSSTransition (a `transition`) and
// plain Animation (`element.animate()`). They need telling apart below
// because only the first two announce their own completion through a
// bubbling DOM event. Both constructors are feature-detected rather than
// assumed: jsdom exposes neither.
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

// Whether this element's look is still in flight, which is what tells a
// transient `opacity: 0` (the first frames of a fade-in — measure it)
// from a permanent one (a closed overlay — skip it).
//
// Transitions count here, unlike keyframe animations they are not
// distinguished: now that a measurement pass only freezes transitions when
// it moves the probe height (see withMeasurementOverrides), an element at
// the very start of a fade-*in* transition genuinely reads `opacity: 0`
// with a running transition and has to be measured. An element fading
// *out* needs no special case — part-way through it reads a fractional
// opacity, so it is measured for as long as it is still visible, and once
// the transition is over it reads `0` with nothing running and drops out.
//
// getAnimations() is feature-detected: jsdom and pre-2020 browsers don't
// implement it, and without it this returns false, which is the safe
// direction (under-measuring a fading-in overlay rather than inflating a
// section by the height of a dismissed one).
const hasActiveAnimation = (el: HTMLElement): boolean =>
  typeof el.getAnimations === 'function' &&
  el.getAnimations().some(animation => isAnimationActive(animation.playState));

// `finished` never resolves for an animation that repeats forever, so a
// handler attached to one would only pin its closure for as long as the
// element lives. No signal is lost by skipping it: such an element is
// perpetually "animating", so hasActiveAnimation keeps it in the estimate
// on every pass anyway.
const neverFinishes = (animation: Animation): boolean => {
  const timing = animation.effect?.getComputedTiming();

  return timing?.iterations === Infinity || timing?.duration === Infinity;
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
//   would catch a mid-transition value instead of the settled one. Only
//   applied on a pass that actually changes the probe height — see
//   `freezeTransitions`.
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

const SCROLLBAR_OVERRIDE_RULES = [
  'html, body { scrollbar-width: none !important; }',
  'html::-webkit-scrollbar, body::-webkit-scrollbar { display: none !important; }',
];

const FREEZE_TRANSITIONS_RULE =
  '*, *::before, *::after { transition: none !important; }';

// `freezeTransitions` is deliberately not always on. `transition: none`
// does not pause a transition for the duration of the measurement — it
// *cancels* it, and lifting the override afterwards does not resume it.
// Measured in Chromium: 0.5s into a 4s fade the element read `0.974`
// with one running animation; inside the override window it read `0`
// with none, and it was still `0` with none 0.8s after the override came
// back off. The element had snapped to its end state for good.
//
// Freezing on every pass therefore killed every transition in the
// preview that happened to overlap a measurement — and because a DOM
// mutation is what both triggers a measurement and typically starts a
// transition (a class toggle opening an overlay), that was most of them.
//
// The guard is only needed for what the measurement *itself* changes:
// the probe height, and with it any `cq*`-unit descendant sized against
// it. When the probe height is unchanged from the last pass, the pass
// changes nothing, so there is nothing to freeze and the preview's own
// transitions are left alone.
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
  // Tracks which script srcs have already been injected into this iframe's
  // document, keyed by src rather than a single loaded/not-loaded boolean —
  // a boolean latched to `true` forever meant a later change to `scripts`
  // (new entries) never got loaded once the first batch had.
  const loadedScriptsRef = useRef<Set<string>>(new Set());
  const prevStyleCountRef = useRef(0);
  const prevStylesheetCountRef = useRef(0);
  // Animations already given a "re-measure once you settle" handler, so a
  // long-running one still in flight across many measurement passes only
  // ever gets one (see trackScriptAnimations). Weak so it never keeps a
  // finished animation — or the element owning it — alive.
  const trackedAnimationsRef = useRef(new WeakSet<Animation>());
  // Lets those handlers call back into the *current* updateHeight without
  // updateHeight having to list itself as its own dependency.
  const updateHeightRef = useRef<(() => void) | null>(null);
  // The probe height the container style was last built for. A pass that
  // leaves it unchanged changes nothing about the document, which is what
  // lets that pass measure without freezing the preview's transitions.
  const lastProbeHeightRef = useRef<number | undefined>(undefined);
  const shouldAutoHeight = autoHeight && style.height == null;

  const styleManagerRef = useRef(createStyleSyncManager());

  const applyStyle = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;

    if (!doc) {
      return;
    }

    reconcileStyles(
      document,
      doc,
      styleManagerRef.current,
      syncStyle,
      convertViewportUnits,
    );
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

  // Permanently hides the iframe document's own scrollbar chrome while
  // autoHeight is sizing the iframe to its content. autoHeight sets the
  // iframe's height to `Math.ceil(contentHeight)`, so sub-pixel content or
  // a rounding remainder can leave the inner document a fraction taller
  // than its viewport — enough for the browser to draw a vertical
  // scrollbar inside every section's iframe (visual noise once several Dnd
  // sections stack). Unlike the measurement-only override above (toggled
  // off after each read), this one stays on: `scrollbar-width`/
  // `::-webkit-scrollbar` hide only the *chrome*, not scrolling itself, so
  // content that ever genuinely exceeds the measured height is still
  // reachable by wheel/keyboard rather than clipped.
  const HIDE_SCROLLBAR_STYLE_ID = 'autoheight-hide-scrollbar';

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

    const text = `html { container-type: size !important; height: ${probeHeight}px !important; }`;

    // Only written when it actually differs. Re-assigning identical
    // textContent would tear down and rebuild the same CSSOM rule on every
    // pass, and the whole point of the probe height being stable is that a
    // pass changes nothing about the document (see freezeTransitions).
    if (styleEl.textContent !== text) {
      styleEl.textContent = text;
    }
  };

  // Script-driven animations are the blind spot the animationend listeners
  // below can't cover: the Web Animations API fires no DOM event when one
  // ends, so nothing would re-run a measurement taken mid-fade. Their
  // `finished` promise is the equivalent signal, so each gets exactly one
  // re-measure scheduled for when it settles.
  //
  // CSS animations are skipped because their `animationend` already bubbles
  // to the mount node — tracking them here too would just measure twice.
  // Transitions are skipped for the reason given in hasActiveAnimation.
  //
  // A cancelled animation rejects `finished` with an AbortError and snaps
  // the element back to its un-animated style, which is as much a reason to
  // re-measure as a clean finish — hence one handler on both settle paths.
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

    // First pass (`undefined`) and any pass that moves the probe height are
    // the only ones that change the container context, so they are the only
    // ones that need the preview's transitions out of the way.
    const freezeTransitions = probeHeight !== lastProbeHeightRef.current;

    lastProbeHeightRef.current = probeHeight;

    withMeasurementOverrides(doc, freezeTransitions, () => {
      ensureContainerStyle(doc, probeHeight);

      // Rewrite vh-family units the container context can't otherwise reach —
      // inline `style` attributes and in-preview `<style>` tags — so they too
      // resolve against the fixed probe height rather than the iframe's own
      // (see rewriteInlineViewportUnits). Must run after ensureContainerStyle
      // and before the reads below; it's idempotent, so the extra observer
      // pass its first-render rewrites trigger converges immediately.
      rewriteInlineViewportUnits(mountNode);

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
        //
        // The animation lookup is confined to the one verdict it can
        // change — whether a fully transparent element is fading in
        // (measure it) or simply not shown (skip it) — so every other
        // element still costs nothing but the computed-style read.
        const isAnimating = style.opacity === '0' && hasActiveAnimation(el);

        if (isVisuallyHidden(style, isAnimating)) {
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

    // Outside the measurement window on purpose: the overrides above cancel
    // running transitions, and this read should see the document's real
    // animation set rather than one the act of measuring just altered.
    trackScriptAnimations(doc, win);
  }, [shouldAutoHeight, mountNode, trackScriptAnimations]);

  useEffect(() => {
    updateHeightRef.current = updateHeight;
  }, [updateHeight]);

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

  // Keyed on mountNode (not just shouldAutoHeight) so it re-runs once the
  // iframe's document exists — before load there's no head to inject into.
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

  // An animation or transition finishing is neither a DOM mutation nor a
  // resize of the mount node, so neither observer above re-runs the
  // measurement — a fixed/absolute element read mid-fade would keep its
  // stale height on the iframe until something unrelated happened to the DOM
  // (#374). All four events bubble, so a single listener each on the mount
  // node covers every descendant.
  //
  // The `cancel` events count as much as the `end` ones: a cancelled
  // animation or transition snaps the element back to its un-animated style,
  // changing the height just the same.
  //
  // `transitionend`/`transitioncancel` used to be unnecessary, because every
  // measurement pass cancelled every transition outright. Now that a pass
  // only freezes transitions when it moves the probe height, a transition
  // can genuinely still be running when a pass reads it, so its completion
  // needs the same re-measure a keyframe animation's does.
  //
  // useEventListener resolves an element target through a ref, so mountNode
  // (portal-owned state, not something this component renders) is wrapped in
  // one that changes identity only when the node itself does. `enabled`
  // keeps it from polling for a node that isn't there yet.
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
