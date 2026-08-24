import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

import useBaseUrl from '@docusaurus/useBaseUrl';

// Embeds a self-contained interactive demo (built from the library source into
// `static/demos/*` — see `demos/vite.config.ts`) directly inside the docs page
// via an <iframe>. The iframe keeps the demo's Tailwind + ui-kit global styles
// fully isolated from Docusaurus' Infima theme, and `loading="lazy"` means the
// demo's heavy bundle only downloads when the reader scrolls it into view.
interface Props {
  // Path under `static/`, e.g. "demos/dnd/". Resolved against the site baseUrl.
  src: string;
  title: string;
  height?: number | string;
  // `Live.Dnd` switches its own internal layout at Tailwind's `md` (768px)
  // breakpoint, evaluated against *this iframe's* width — not the reader's
  // browser window. Sized to the article column (the default), that
  // breakpoint only clears above a ~2560px browser viewport (see #215), so
  // every realistic desktop width shows the mobile drawer layout instead of
  // the desktop palette the page's copy describes. `breakout` escapes the
  // iframe past the article column's max-width, right up to the page edges,
  // which clears `md` from ~1150px up.
  //
  // Measured with JS (getBoundingClientRect on the iframe's own, untouched
  // parent, and on `<main>`) rather than a pure-CSS `100vw`/`-50vw`
  // full-bleed trick — #224 found two independent ways that trick breaks
  // on this site's actual doc layout: (1) a
  // `--scrollbar-width: calc(100vw - 100%)` custom property doesn't
  // resolve once at :root the way a real constant would — CSS substitutes
  // it as a token stream at each *use* site, re-resolving `100%` there,
  // which made #221's version a complete no-op (its width and margin
  // cancelled back to exactly the container's own box); (2) even the
  // original `100vw`/`-50vw` form (#215) assumes the container is
  // horizontally centered in the viewport, which doesn't hold on this
  // layout (a left sidebar), so it overflowed the visible viewport on the
  // right by however far off-center the column actually sits. Bounding
  // the breakout at `<main>`'s own left edge (a sibling of the doc
  // sidebar, so never including its width) rather than the viewport's
  // left edge (x=0) also matters: an earlier version of this fix shifted
  // all the way to x=0, which visually slid the iframe underneath/over
  // the sidebar instead of stopping next to it.
  breakout?: boolean;
}

const baseStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--ifm-color-emphasis-300)',
  borderRadius: 'var(--ifm-global-radius)',
  background: 'var(--ifm-background-surface-color)',
};

export default function DemoFrame({
  src,
  title,
  height = 560,
  breakout = false,
}: Props): ReactNode {
  const url = useBaseUrl(src);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Empty until the first post-mount measurement, so server-rendered and
  // first-paint markup is the safe non-breakout (100%-width) layout rather
  // than a guess — avoids ever rendering an overflowing box, at the cost
  // of a one-time widen once JS measures the real position.
  const [breakoutStyle, setBreakoutStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!breakout) {
      return;
    }

    const update = () => {
      const iframe = iframeRef.current;
      // Measures the iframe's own parent, not the iframe itself: the
      // parent is never given breakout styles, so its rect stays an
      // accurate, stable reference on every recomputation. Measuring the
      // iframe directly here would read back whatever offset a *previous*
      // update already applied, compounding instead of correcting.
      const parent = iframe?.parentElement;

      if (!iframe || !parent) {
        return;
      }

      const parentRect = parent.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      // Docusaurus' doc sidebar (`<aside class="theme-doc-sidebar-...">`)
      // is a sibling of `<main>`, not an ancestor of the iframe — so
      // `<main>`'s own left edge sits right after it. Bounding the
      // breakout there (instead of at the viewport's left edge, x=0)
      // keeps it from sliding underneath/over the sidebar, which is what
      // shifting all the way to x=0 did.
      const main = iframe.closest('main');
      const leftBound = main
        ? main.getBoundingClientRect().left
        : parentRect.left;
      // Clamped so a missing/misplaced `<main>` can only ever shrink the
      // breakout back toward "no-op", never push it the wrong direction.
      const marginLeft = Math.min(0, leftBound - parentRect.left);
      const width = Math.max(parentRect.width, viewportWidth - leftBound);

      setBreakoutStyle({
        position: 'relative',
        width: `${width}px`,
        maxWidth: `${width}px`,
        marginLeft: `${marginLeft}px`,
      });
    };

    update();

    const parent = iframeRef.current?.parentElement;
    const resizeObserver = parent ? new ResizeObserver(update) : undefined;
    resizeObserver?.observe(parent!);
    // Belt-and-suspenders alongside the ResizeObserver: a scrollbar
    // appearing/disappearing (changing document.documentElement.clientWidth)
    // doesn't necessarily resize the column element the observer watches.
    window.addEventListener('resize', update);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [breakout]);

  // The demos are served from `static/demos/*` on the same origin as the docs
  // site and run arbitrary reader-authored code (the Editor demo compiles and
  // runs whatever is typed). Without a sandbox that makes the frame same-origin
  // *and* unsandboxed, so demo code could reach `window.parent` and script the
  // docs page. `sandbox="allow-scripts"` drops the frame into an opaque origin,
  // which removes that parent access while still letting the self-contained
  // bundles run. `allow-same-origin` is intentionally omitted — combined with
  // `allow-scripts` it would hand the frame its origin back and defeat this.
  return (
    <iframe
      ref={iframeRef}
      src={url}
      title={title}
      loading="lazy"
      style={{ ...baseStyle, height, ...breakoutStyle }}
      sandbox="allow-scripts"
    />
  );
}
