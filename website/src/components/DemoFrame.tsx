import type { CSSProperties, ReactNode } from 'react';

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
  // which clears `md` from ~1150px up. `box-sizing: border-box` matters
  // here: without it, the 1px border pushes the content box (and so the
  // breakpoint check) 2px narrower than the frame's own reported width,
  // occasionally missing `md` by exactly that margin.
  breakout?: boolean;
}

export default function DemoFrame({
  src,
  title,
  height = 560,
  breakout = false,
}: Props): ReactNode {
  const url = useBaseUrl(src);

  const style: CSSProperties = {
    display: 'block',
    width: '100%',
    height,
    boxSizing: 'border-box',
    border: '1px solid var(--ifm-color-emphasis-300)',
    borderRadius: 'var(--ifm-global-radius)',
    background: 'var(--ifm-background-surface-color)',
    ...(breakout && {
      position: 'relative',
      width: '100vw',
      maxWidth: '100vw',
      left: '50%',
      marginLeft: '-50vw',
    }),
  };

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
      src={url}
      title={title}
      loading="lazy"
      style={style}
      sandbox="allow-scripts"
    />
  );
}
