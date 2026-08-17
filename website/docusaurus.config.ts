import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

// Base URL of the deployed interactive Live Editor app that the docs link out
// to ("Open live demo" buttons). Kept in one place so it can be swapped once
// the app's final home is decided. Read at runtime via
// siteConfig.customFields.appUrl (see src/components/LiveDemo.tsx).
const APP_URL = 'https://pjb0811.github.io/live-editor';

const config: Config = {
  title: 'Live Editor',
  tagline: 'Interactive UI editor with real-time preview and drag-and-drop',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://pjb0811.github.io',
  baseUrl: '/',

  organizationName: 'pjb0811',
  projectName: 'live-editor',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  customFields: {
    appUrl: APP_URL,
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/pjb0811/live-editor/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Live Editor',
      logo: {
        alt: 'Live Editor Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: APP_URL,
          label: 'Live Demo',
          position: 'left',
        },
        {
          href: 'https://github.com/pjb0811/live-editor',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://www.npmjs.com/package/@jbpark/live-editor',
          label: 'npm',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Overview', to: '/docs/intro' },
            { label: 'Drag & Drop', to: '/docs/drag-and-drop' },
            { label: 'Preview Modes', to: '/docs/preview-modes' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'Live Demo', href: APP_URL },
            {
              label: 'GitHub',
              href: 'https://github.com/pjb0811/live-editor',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/@jbpark/live-editor',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} jbpark. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
