import { hasActiveAnimation } from './animations';
import {
  FALLBACK_PROBE_HEIGHT,
  computeProbeHeight,
  isVisuallyHidden,
  positionedElementBottom,
  verticalInsets,
} from './measure';
import { rewriteInlineViewportUnits } from './viewport-units';

// The style that makes `<html>` a size container, found again by this id.
// Scoped to `html`, so it only affects how `cq*` units resolve.
export const CONTAINER_STYLE_ID = 'autoheight-container';

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

export const SCROLLBAR_OVERRIDE_RULES = [
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
export const withMeasurementOverrides = (
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

// Hides the iframe document's scrollbar while `autoHeight` sizes it.
// Rounding can leave the document a fraction taller than the iframe, which
// would draw a scrollbar in every section. Unlike the measurement override,
// this stays on. Scrolling still works if the content ever outgrows it.
export const HIDE_SCROLLBAR_STYLE_ID = 'autoheight-hide-scrollbar';

// Makes `<html>` a size container with a fixed height, `probeHeight`, the
// scroll container's available height. Viewport units are rewritten to `cq*`
// units (`convertViewportUnits`), so they resolve against this height
// instead of the iframe's own. Against the iframe's own height, `100vh`
// content would grow the iframe, which grows the content again, and never
// settle (#132).
export const ensureContainerStyle = (doc: Document, probeHeight: number) => {
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

// The height the preview's `cq*` units resolve against, read from the
// iframe's scroll container. `null` while the layout isn't ready.
export const getProbeHeight = (
  iframe: HTMLIFrameElement,
  win: Window,
): number | null => {
  const scrollParent = iframe.closest<HTMLElement>('[data-frame-container]');

  if (!scrollParent) {
    // No scroll container (`Frame` used without `Live.Dnd`): use a fixed
    // default. See `FALLBACK_PROBE_HEIGHT`.
    return FALLBACK_PROBE_HEIGHT;
  }

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

  return computeProbeHeight(scrollParent.clientHeight, wrapperInsets);
};

// The height of the preview's content with the iframe sized to
// `probeHeight`: the mount node's `scrollHeight`, or the bottom edge of a
// fixed or absolute element if that reaches further. Runs inside the
// measurement overrides, and writes the container style and the rewritten
// viewport units into the document.
export const measureContentHeight = (
  mountNode: HTMLElement,
  doc: Document,
  win: Window,
  probeHeight: number,
  freezeTransitions: boolean,
): number => {
  let contentHeight = 0;

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

  return contentHeight;
};
