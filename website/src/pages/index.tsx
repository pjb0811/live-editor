import { useState } from 'react';
import type { ReactNode } from 'react';

import { useHistory } from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { Button, Card, Typography } from '@jbpark/ui-kit';
import Layout from '@theme/Layout';
import {
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  Eye,
  MousePointer2,
  Sparkles,
} from 'lucide-react';

import styles from './index.module.css';

const NPM_PACKAGE = '@jbpark/live-editor';
const NPM_BADGE_URL = `https://img.shields.io/npm/v/${NPM_PACKAGE}.svg?style=flat-square&color=black&labelColor=eeeeee`;
const GITHUB_URL = 'https://github.com/pjb0811/live-editor';
const INSTALL_COMMAND = `npm install ${NPM_PACKAGE}`;

const FEATURES = [
  {
    icon: Eye,
    title: 'Real-time Preview',
    description:
      'Edit code and see it render instantly in an isolated iframe or shadow DOM. The editor and preview share one context, so they always stay in sync.',
  },
  {
    icon: MousePointer2,
    title: 'Drag & Drop',
    description:
      'Build UIs visually — drag components onto the canvas and edit their properties from a side panel, all powered by @dnd-kit.',
  },
  {
    icon: Sparkles,
    title: 'AST-synced Source',
    description:
      'Canvas edits are applied through AST transforms and written back to clean, canonical source code — no lossy round-trips.',
  },
] as const;

function InstallCommand() {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable, ignore
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copy install command"
      className={styles.installCommand}
    >
      <span>{INSTALL_COMMAND}</span>
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  const history = useHistory();
  const docsUrl = useBaseUrl('/docs/intro');

  return (
    <header className={styles.hero}>
      <img src={NPM_BADGE_URL} alt="npm version" className={styles.badge} />
      <Typography.Title level={1}>{siteConfig.title}</Typography.Title>
      <Typography.Paragraph className={styles.subtitle}>
        {siteConfig.tagline}
      </Typography.Paragraph>
      <div className={styles.actions}>
        <InstallCommand />
        <div className={styles.buttonGroup}>
          <Button
            type="primary"
            icon={<BookOpen size={16} />}
            onClick={() => history.push(docsUrl)}
          >
            Get Started
          </Button>
          <Button
            icon={<ExternalLink size={16} />}
            onClick={() => window.open(GITHUB_URL, '_blank')}
          >
            GitHub
          </Button>
        </div>
      </div>
    </header>
  );
}

function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <Typography.Title level={2} className={styles.sectionTitle}>
        Why Live Editor
      </Typography.Title>
      <div className={styles.featureGrid}>
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <div className={styles.featureIcon}>
              <Icon size={20} />
            </div>
            <Typography.Title level={5}>{title}</Typography.Title>
            <Typography.Paragraph className={styles.subtitle}>
              {description}
            </Typography.Paragraph>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline as string}>
      <main className={styles.main}>
        <HomepageHeader />
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
