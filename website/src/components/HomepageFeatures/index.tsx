import type { ReactNode } from 'react';

import Heading from '@theme/Heading';
import clsx from 'clsx';

import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Real-time Preview',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
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
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Build UIs visually — drag components onto the canvas and edit their
        properties from a side panel, all powered by <code>@dnd-kit</code>.
      </>
    ),
  },
  {
    title: 'AST-synced Source',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Canvas edits are applied through AST transforms and written back to
        clean, canonical source code — no lossy round-trips.
      </>
    ),
  },
];

function Feature({ title, Svg, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
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
