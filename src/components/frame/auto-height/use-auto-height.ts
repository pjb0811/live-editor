import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';

import {
  useEventListener,
  useMutationObserver,
  useResizeObserver,
} from '@jbpark/use-hooks';

import { isCssAnimation, isCssTransition, neverFinishes } from './animations';
import {
  CONTAINER_STYLE_ID,
  HIDE_SCROLLBAR_STYLE_ID,
  SCROLLBAR_OVERRIDE_RULES,
  getProbeHeight,
  measureContentHeight,
} from './auto-height';
import { isAnimationActive } from './measure';

// Sizes the iframe to its content while `shouldAutoHeight` is on, and
// re-measures when anything that can change the height does. Also owns the
// document styles that only `autoHeight` needs. Call it after the hooks that
// set up the document: the effects below rely on running after them.
export const useAutoHeight = (
  iframeRef: RefObject<HTMLIFrameElement | null>,
  mountNode: HTMLElement | null,
  shouldAutoHeight: boolean,
) => {
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

    const probeHeight = getProbeHeight(iframe, win);

    if (probeHeight === null) {
      // Layout isn't ready yet: skip this pass. The observers call this again
      // once it settles.
      return;
    }

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

    const contentHeight = measureContentHeight(
      mountNode,
      doc,
      win,
      probeHeight,
      freezeTransitions,
    );

    iframe.style.height =
      contentHeight > 0 ? `${Math.ceil(contentHeight)}px` : previousHeight;

    // After the measurement window, which can cancel transitions, so this sees
    // the document's real animations.
    trackScriptAnimations(doc, win);
  }, [iframeRef, shouldAutoHeight, mountNode, trackScriptAnimations]);

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
  }, [iframeRef, shouldAutoHeight]);

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
  }, [iframeRef, shouldAutoHeight, mountNode]);

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
    styleEl.textContent = SCROLLBAR_OVERRIDE_RULES.join('\n');
    doc.head.appendChild(styleEl);
  }, [iframeRef, shouldAutoHeight, mountNode]);

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

  // Runs on each size the resize observer reports. `updateHeight` stays out
  // of the deps: the effect above already runs it whenever it changes.
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
};
