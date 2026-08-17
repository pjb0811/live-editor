import type { ReactNode } from 'react';

import Heading from '@theme/Heading';
import clsx from 'clsx';

import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  icon: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Real-time Preview',
    icon: '👁️',
    description: (
      <>
        Edit code and see it render instantly in an isolated iframe or shadow
        DOM. The editor and preview share one context, so they always stay in
        sync.
      </>
    ),
  },
  {
    title: 'Drag & Drop',
    icon: '🧲',
    description: (
      <>
        Build UIs visually — drag components onto the canvas and edit their
        properties from a side panel, all powered by <code>@dnd-kit</code>.
      </>
    ),
  },
  {
    title: 'AST-synced Source',
    icon: '✨',
    description: (
      <>
        Canvas edits are applied through AST transforms and written back to
        clean, canonical source code — no lossy round-trips.
      </>
    ),
  },
];

function Feature({ title, icon, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <div className={styles.featureIcon} role="img" aria-label={title}>
          {icon}
        </div>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
