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
  // parent) rather than a pure-CSS `100vw`/`-50vw` full-bleed trick — #224
  // found two independent ways that trick breaks on this site's actual doc
  // layout: (1) a `--scrollbar-width: calc(100vw - 100%)` custom property
  // doesn't resolve once at :root the way a real constant would — CSS
  // substitutes it as a token stream at each *use* site, re-resolving
  // `100%` there, which made #221's version a complete no-op (its width
  // and margin cancelled back to exactly the container's own box); (2)
  // even the original `100vw`/`-50vw` form (#215) assumes the container is
  // horizontally centered in the viewport, which doesn't hold on this
  // layout (a left sidebar), so it overflowed the visible viewport on the
  // right by however far off-center the column actually sits. Measuring
  // the real DOM position sidesteps both: no constant-folding assumption,
  // no centering assumption.
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
      // Measures the iframe's own parent, not the iframe itself: the
      // parent is never given breakout styles, so its rect stays an
      // accurate, stable reference on every recomputation. Measuring the
      // iframe directly here would read back whatever offset a *previous*
      // update already applied, compounding instead of correcting.
      const parent = iframeRef.current?.parentElement;

      if (!parent) {
        return;
      }

      const rect = parent.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;

      setBreakoutStyle({
        position: 'relative',
        width: `${viewportWidth}px`,
        maxWidth: `${viewportWidth}px`,
        marginLeft: `${-rect.left}px`,
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
