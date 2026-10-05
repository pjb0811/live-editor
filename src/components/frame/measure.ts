// The calculations behind `iframe.tsx`'s `autoHeight`, kept free of the DOM
// so they can be unit-tested. The DOM reads stay in `iframe.tsx`, which needs
// a real browser to test.

// The probe height when there's no `[data-frame-container]` scroll
// container, as when `Frame` is used without `Live.Dnd`. A common mobile
// viewport height.
export const FALLBACK_PROBE_HEIGHT = 812;

// The vertical space an element takes around its content: margin, border
// and padding, top and bottom. Margin counts (#440), or a `100vh` section in
// a wrapper with a margin would overflow the container by that margin. A
// margin that collapses through a parent is counted twice, which errs toward
// a smaller probe that fits.
export const verticalInsets = (
  style: Pick<
    CSSStyleDeclaration,
    | 'marginTop'
    | 'marginBottom'
    | 'borderTopWidth'
    | 'borderBottomWidth'
    | 'paddingTop'
    | 'paddingBottom'
  >,
): number =>
  [
    style.marginTop,
    style.marginBottom,
    style.borderTopWidth,
    style.borderBottomWidth,
    style.paddingTop,
    style.paddingBottom,
  ].reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

// The height the preview's `cq*` units resolve against: the scroll
// container's `clientHeight` minus `wrapperInsets`, the space everything
// between the iframe and the container takes (`verticalInsets`). `null`
// while the container isn't laid out yet: skip the pass rather than guess a
// height that nothing would correct later.
export const computeProbeHeight = (
  scrollContainerClientHeight: number,
  wrapperInsets: number,
): number | null => {
  const usable = scrollContainerClientHeight - wrapperInsets;

  return usable > 0 ? usable : null;
};

// Whether an element is hidden but still takes height: `visibility: hidden`
// or `opacity: 0` (`display: none` already reads 0), such as a closed bottom
// sheet. A transparent element that `isAnimating` is a fade-in starting, so
// it's measured (#374). `visibility: hidden` stays hidden even while
// animating.
export const isVisuallyHidden = (
  computed: {
    visibility: string;
    opacity: string;
  },
  isAnimating = false,
): boolean =>
  computed.visibility === 'hidden' ||
  (computed.opacity === '0' && !isAnimating);

// The `playState`s that mean the element is still changing. Not just
// `!== 'idle'`: a finished fade-out with `fill-mode: forwards` stays
// `finished` at `opacity: 0` and is hidden for good. `paused` counts, since
// a paused fade-in stopped part-way.
export const isAnimationActive = (playState: string): boolean =>
  playState === 'running' || playState === 'paused';

// The Y offset of a `translate(x, y)`, `translateY(y)` or
// `matrix(a, b, c, d, tx, ty)` transform, or 0 for anything else. Positioned
// overlays are often moved this way (Radix, floating-ui), so their bottom
// edge is `offsetY + offsetHeight`. Browsers report computed transforms as
// `matrix(...)`; the other forms cover an inline style.
export const parseTranslateY = (transform: string): number => {
  if (!transform || transform === 'none') {
    return 0;
  }

  // `translateY(y)` has one argument, so it's matched on its own, before
  // `translate(x, y)`.
  const translateYMatch = transform.match(/translateY\(\s*([+-]?\d*\.?\d+)/);

  if (translateYMatch?.[1]) {
    return parseFloat(translateYMatch[1]);
  }

  const translateMatch = transform.match(
    /translate\([^,]+,\s*([+-]?\d*\.?\d+)/,
  );

  if (translateMatch?.[1]) {
    return parseFloat(translateMatch[1]);
  }

  const matrixMatch = transform.match(
    /matrix\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([+-]?\d*\.?\d+)/,
  );

  return matrixMatch?.[1] ? parseFloat(matrixMatch[1]) : 0;
};

// The height a fixed or absolute element adds: its offset plus its height,
// capped at `probeHeight`, so one element placed past the viewport can't
// stretch the whole preview.
export const estimatePositionedElementHeight = (
  offsetHeight: number,
  transform: string,
  probeHeight: number,
): number => {
  const offsetY = parseTranslateY(transform);

  return Math.min(offsetY + offsetHeight, probeHeight);
};
