// Part of #132 stage 1 — porting the internal GitLab fork's autoHeight
// height-measurement redesign into this repo, one verifiable stage at a
// time (see the issue for the full plan and why the current `updateHeight`
// implementation needs replacing: folding the iframe to 0px before
// measuring permanently collapses `vh`-sized content to 0, since `vh`
// units resolve against the iframe's own height).
//
// The fork's fix replaces the iframe height as `vh`'s reference point with
// a fixed-size CSS containment context (`html { container-type: size;
// height: <probe>px }`) — see stage 2. That only works if the document's
// own `vh`/`svh`/`lvh`/`dvh`/`vmin`/`vmax` usages are first rewritten to
// the matching container-query unit (`cqh`/`cqmin`/`cqmax`), since a size
// container doesn't retroactively change what `vh` itself resolves
// against. `vw`/`vi` are deliberately left alone: they resolve against
// width, which this measurement never touches, so rewriting them would
// only add risk with no corresponding bug to fix.
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

// Requires the matched number not to be immediately preceded by a letter,
// digit, underscore, `.`, or `-` — this is what keeps `url(a5vh.png)`,
// `.a5vh{}`, and `.hero-100vh{}` untouched (in all three, the digits
// before `vh` are part of a larger filename/class-name token, not a
// standalone CSS number) without needing any special-casing for
// `url(...)`/selectors specifically. `-` has to be excluded too, not just
// `\w`/`.`, since a kebab-case identifier like `hero-100vh` uses it as a
// word separator the same way `a5vh` uses no separator at all — otherwise
// the number pattern's own optional leading `-?` would happily treat that
// hyphen as a negative sign instead. This doesn't break real negative
// values (`margin-top: -10vh`): there the character *before* the `-` is
// whatever precedes the whole declaration (a space, in practice), so the
// lookbehind still passes and the leading `-` is captured as part of the
// number, same as before.
//
// Separately, `--my-vh: 10px` was never a candidate to begin with: there's
// no digit immediately before `vh` there at all (the `y` in `-vh` is a
// letter, not a number), so the pattern doesn't even try to match it.
const VIEWPORT_UNIT_RE = new RegExp(
  `(?<![\\w.-])(${NUMBER_PATTERN})(${UNITS_PATTERN})(?![a-zA-Z0-9_-])`,
  'gi',
);

// Rewrites vh/svh/lvh/dvh/vmin/vmax to their cqh/cqmin/cqmax equivalent
// wherever they appear as an actual CSS dimension — including nested
// inside calc()/var() fallbacks, since this is a plain text substitution
// rather than a CSS-aware parse. `vw` is left as-is (see UNIT_MAP above).
//
// Known limitation, inherited from the source fork and not fixed here:
// this can't distinguish a real dimension from the same text sitting
// inside a CSS string literal, e.g. `content: "100vh"` — the regex has no
// concept of quoting, so that string's contents get rewritten too. In
// practice this is rare (a `content` value that's coincidentally shaped
// like a viewport dimension) and doesn't affect layout, since `content`
// strings aren't parsed as CSS values.
export const convertViewportUnits = (css: string): string =>
  css.replace(
    VIEWPORT_UNIT_RE,
    (_match, number: string, unit: string) =>
      number + UNIT_MAP[unit.toLowerCase()],
  );
