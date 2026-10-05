// Rewrites viewport units to container units for `autoHeight` (#132). The
// iframe measures its content against a fixed-height size container
// (`html { container-type: size; height: <probe>px }`), but a size container
// doesn't change what `vh` resolves against, so `vh`, `svh`, `lvh`, `dvh`,
// `vmin` and `vmax` become `cqh`, `cqmin` and `cqmax`. `vw` and `vi` are left
// alone: they depend on width, which the measurement doesn't touch.
const UNIT_MAP: Record<string, string> = {
  vh: 'cqh',
  svh: 'cqh',
  lvh: 'cqh',
  dvh: 'cqh',
  vmin: 'cqmin',
  vmax: 'cqmax',
};

// Longest-unit-first so `svh`/`lvh`/`dvh` aren't shadowed by a shorter
// alternative matching a prefix of them first.
const UNITS_PATTERN = Object.keys(UNIT_MAP)
  .sort((a, b) => b.length - a.length)
  .join('|');

// A CSS dimension token: optional sign, then digits with an optional
// fractional part on either side of the decimal point (`100`, `50.5`,
// `-10`, `.5` all match; a bare `-` or `.` alone does not).
const NUMBER_PATTERN = '-?(?:\\d+\\.?\\d*|\\.\\d+)';

// The number must not follow a letter, digit, `_`, `.` or `-`, so
// `url(a5vh.png)`, `.a5vh{}` and `.hero-100vh{}` stay as they are: those
// digits belong to a name. A real negative value (`margin-top: -10vh`) still
// matches, since a space comes before its `-`. `--my-vh` never matches:
// there's no number before `vh`.
const VIEWPORT_UNIT_RE = new RegExp(
  `(?<![\\w.-])(${NUMBER_PATTERN})(${UNITS_PATTERN})(?![a-zA-Z0-9_-])`,
  'gi',
);

// Rewrites `vh`, `svh`, `lvh`, `dvh`, `vmin` and `vmax` to `cqh`, `cqmin` and
// `cqmax` wherever they appear as a dimension, including inside `calc()` and
// `var()` fallbacks. `vw` stays (see `UNIT_MAP`). A plain text replacement,
// so a value in a CSS string such as `content: "100vh"` is rewritten too,
// which doesn't affect layout.
export const convertViewportUnits = (css: string): string =>
  css.replace(
    VIEWPORT_UNIT_RE,
    (_match, number: string, unit: string) =>
      number + UNIT_MAP[unit.toLowerCase()],
  );

// Rewrites viewport units in the two places `convertViewportUnits` doesn't
// see: inline `style` attributes (which panel edits produce) and `<style>`
// elements the preview renders itself. Without this, their `vh` would
// resolve against the iframe's own height again (#132). Call it from
// `updateHeight` after the container style is applied, before reading any
// height.
//
// Idempotent: converted values no longer match the selectors, and a node is
// written only when its text changes. A write would trigger the
// MutationObserver in `iframe.tsx` again and loop.
export const rewriteInlineViewportUnits = (root: HTMLElement): void => {
  // `vh` as a substring already covers `svh`/`lvh`/`dvh`; `vmin`/`vmax` need
  // their own terms. Case-insensitive so `100VH` inline is caught too.
  const inlineTargets = root.querySelectorAll<HTMLElement>(
    '[style*="vh" i], [style*="vmin" i], [style*="vmax" i]',
  );

  inlineTargets.forEach(el => {
    const current = el.getAttribute('style');

    if (current == null) {
      return;
    }

    const converted = convertViewportUnits(current);

    if (converted !== current) {
      el.setAttribute('style', converted);
    }
  });

  root.querySelectorAll<HTMLStyleElement>('style').forEach(styleEl => {
    const current = styleEl.textContent;

    if (!current) {
      return;
    }

    const converted = convertViewportUnits(current);

    if (converted !== current) {
      styleEl.textContent = converted;
    }
  });
};
