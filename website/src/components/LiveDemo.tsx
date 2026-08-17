import type { ReactNode } from 'react';

import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

// A call-to-action button linking out to the deployed interactive Live Editor
// app. The docs themselves are static (prose + code) so they stay inside
// Docusaurus' theme; the actual hands-on editor lives in the standalone app,
// reached from here. The base URL comes from siteConfig.customFields.appUrl so
// it lives in exactly one place (docusaurus.config.ts).
interface Props {
  // Path within the app, e.g. "/editor" or "/preview". Defaults to the app root.
  to?: string;
  children?: ReactNode;
}

export default function LiveDemo({ to = '', children }: Props): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  const appUrl = (siteConfig.customFields?.appUrl as string) ?? '/';
  const href = `${appUrl}${to}`;

  return (
    <Link className="button button--primary button--lg" to={href}>
      {children ?? '▶ Open live demo'}
    </Link>
  );
}
