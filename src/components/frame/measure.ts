// Pure helpers behind iframe.tsx's autoHeight measurement (#132 stages
// 2-3) — kept DOM-free so they're testable under this repo's node-
// environment vitest setup; the DOM walking itself (getComputedStyle,
// querySelectorAll, offsetHeight reads) has no real layout engine to run
// against outside a real browser and stays in iframe.tsx, verified
// separately with a real Chromium instance instead of a unit test.

// A fallback used only when there's no `[data-frame-container]` scroll
// container to measure against at all — e.g. `Frame` used directly by a
// library consumer, without `Dnd`. There's no better reference height to
// wait for in that case (unlike the "container exists but hasn't laid out
// yet" case below, which defers instead), so this just needs to be *some*
// reasonable default. Matches the source fork's own constant — a common
// mobile viewport height, chosen there for the same reason.
export const FALLBACK_PROBE_HEIGHT = 812;

// The reference height for the preview's CSS containment context (see
// ensureContainerStyle in iframe.tsx) — everything sized in `vh`-family
// units (converted to `cqh` by convertViewportUnits) resolves against
// this instead of the iframe's own height, which is what breaks the old
// approach's fold-to-0px-then-measure circularity (#132 problem 1).
//
// `clientHeight` already excludes the scroll container's own border, but
// not any padding/border on wrapper elements *between* the iframe and
// that container (this codebase's own Sortable/Renderer/Frame don't add
// any today, but a consumer's own `provider`/`renderPanel` wrapper
// could) — `wrapperInsets` is the sum of those, added up by the caller
// while walking from the iframe to the scroll container.
//
// Returns `null` (not a guessed fallback) when the container hasn't been
// laid out yet (`clientHeight` still 0, e.g. mid-transition) — the
// caller should skip this measurement pass rather than settle on a
// number that has nothing to do with the actual available space and
// that no future event would ever correct (see the issue's own
// reasoning for why a `window.innerHeight` fallback here was wrong).
export const computeProbeHeight = (
  scrollContainerClientHeight: number,
  wrapperInsets: number,
): number | null => {
  const usable = scrollContainerClientHeight - wrapperInsets;

  return usable > 0 ? usable : null;
};

// `visibility:hidden` and `opacity:0` elements keep a non-zero
// offsetHeight/scrollHeight (unlike `display:none`, which zeroes them
// out on its own) — without this check, a closed bottom sheet or a
// not-yet-faded-in overlay sitting in the DOM inflates the measured
// height by however tall it would be if shown.
export const isVisuallyHidden = (computed: {
  visibility: string;
  opacity: string;
}): boolean => computed.visibility === 'hidden' || computed.opacity === '0';

// `translate(Xpx, Ypx)` / `translateY(Ypx)` / `matrix(a,b,c,d,tx,ty)`'s Y
// component — a positioned popup/overlay is commonly offset this way
// (Radix/floating-ui do), so its *effective* bottom edge is `offsetY +
// offsetHeight` from its positioned ancestor, not just `offsetHeight`
// alone. Returns 0 for anything else (no transform, or an X-only/
// unrecognized one) rather than throwing — an unparsed offset is safer
// treated as "no extra offset" than as a measurement failure.
//
// iframe.tsx's only caller passes `getComputedStyle(el).transform`, which
// every real browser normalizes to `matrix(...)` regardless of what
// syntax (translate/translateY/none of the above) the original CSS used
// — confirmed against a real Chromium instance, not assumed. The
// translate()/translateY() branches mainly document intent and cover any
// future caller that passes an *inline* style's transform instead (which
// does preserve the author's original syntax).
export const parseTranslateY = (transform: string): number => {
  if (!transform || transform === 'none') {
    return 0;
  }

  // translateY(y) is single-argument — tried first and separately from
  // translate(x, y), since a naive "match the arg after a comma" pattern
  // has no comma to find here at all and would silently fall through to 0.
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

// A `position:fixed`/`absolute` element is placed relative to the
// viewport (or the nearest positioned ancestor, which for this preview
// content is effectively the same scale) — `offsetY + offsetHeight` can
// legitimately exceed the probe height (e.g. an element deliberately
// positioned to bleed off-screen), but letting an unbounded value drive
// the *whole document's* measured height would make one runaway overlay
// balloon everything below it. Capping at `probeHeight` treats "this
// element's bottom edge is somewhere past the viewport" the same as "at
// the viewport edge" for sizing purposes, without needing to know how far
// past.
export const estimatePositionedElementHeight = (
  offsetHeight: number,
  transform: string,
  probeHeight: number,
): number => {
  const offsetY = parseTranslateY(transform);

  return Math.min(offsetY + offsetHeight, probeHeight);
};
