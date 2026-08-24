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
  // the desktop palette the page's copy describes.
  //
  // `breakout` widens the doc's own Infima `.container` (via the
  // `[data-breakout]` selector in custom.css) instead of trying to escape
  // it with position/margin full-bleed math. Two earlier approaches both
  // got that math wrong in ways this environment couldn't visually verify
  // before shipping: a `--scrollbar-width: calc(100vw - 100%)` custom
  // property that doesn't fold to a constant the way `:root` suggests
  // (#224), and a JS-measured version that then slid under the doc
  // sidebar because it measured to the viewport's edge instead of
  // `<main>`'s. Widening `.container` in place has a much safer failure
  // mode: if the `:has()` selector doesn't match for any reason, the page
  // just keeps its normal column width — never wider than the viewport,
  // never overlapping the sidebar, because there's no position/width
  // arithmetic to get wrong in the first place. Tradeoff: this widens the
  // whole page's prose on these two pages, not just the demo — accepted
  // for now in exchange for that reliability.
  breakout?: boolean;
}

const style: CSSProperties = {
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

  return (
    <iframe
      src={url}
      title={title}
      loading="lazy"
      style={{ ...style, height }}
      sandbox="allow-scripts"
      {...(breakout ? { 'data-breakout': true } : {})}
    />
  );
}
