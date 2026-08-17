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

  return <iframe src={url} title={title} loading="lazy" style={style} />;
}
