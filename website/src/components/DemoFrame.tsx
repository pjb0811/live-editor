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
}

export default function DemoFrame({
  src,
  title,
  height = 560,
}: Props): ReactNode {
  const url = useBaseUrl(src);

  const style: CSSProperties = {
    display: 'block',
    width: '100%',
    height,
    border: '1px solid var(--ifm-color-emphasis-300)',
    borderRadius: 'var(--ifm-global-radius)',
    background: 'var(--ifm-background-surface-color)',
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
