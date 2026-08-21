import type * as Preset from '@docusaurus/preset-classic';
import type { Config, Plugin } from '@docusaurus/types';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { themes as prismThemes } from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const dirname = path.dirname(fileURLToPath(import.meta.url));

// `@jbpark/live-editor` resolves to `link:..` (see package.json) so this
// site always builds against the same source as demos/vite.config.ts's
// direct `../src` import, rather than whatever was last published to npm —
// see #216. A symlinked dependency's own `require`/`import` calls resolve
// relative to the symlink's real path (the repo root) unless told
// otherwise, which would walk up to the *root* project's node_modules/react
// instead of this project's — two separate React instances, the classic
// "Invalid hook call" failure. `resolve.symlinks: false` keeps resolution
// relative to this project regardless of the symlink, and the explicit
// aliases are a second, more direct guarantee for react/react-dom
// specifically. Plain `resolve` config, not a bundler-specific plugin
// instance — works whether `@docusaurus/faster` picks webpack or rspack.
const dedupeReactPlugin = (): Plugin => ({
  name: 'dedupe-react-for-linked-live-editor',
  configureWebpack: () => ({
    resolve: {
      symlinks: false,
      alias: {
        react: path.resolve(dirname, 'node_modules/react'),
        'react-dom': path.resolve(dirname, 'node_modules/react-dom'),
      },
    },
  }),
});

const config: Config = {
  title: 'Live Editor',
  tagline: 'Interactive UI editor with real-time preview and drag-and-drop',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  // Vercel is the live deploy target (see vercel.json); GitHub Pages was
  // retired in bff287d. `url` + `baseUrl` must match it, since canonical
  // <link> tags, sitemap.xml, and Open Graph URLs are all derived from them.
  url: 'https://live-editor-lab.vercel.app',
  baseUrl: '/',

  organizationName: 'pjb0811',
  projectName: 'live-editor',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  // `@jbpark/live-editor` bundles `@babel/types` (see tsdown.config.ts's
  // `deps.onlyBundle`), which reads `process.env.BABEL_TYPES_8_BREAKING` at
  // module load time. Neither webpack 5 nor rspack (whichever
  // `@docusaurus/faster` picks) polyfills `process` for the client bundle,
  // so without this PreviewModesDemo — the one demo embedded directly
  // rather than via a sandboxed iframe, see #206 — crashes on load with
  // "process is not defined". A client module (bundler-agnostic, unlike a
  // webpack/rspack-specific DefinePlugin) is the simplest fix: it only runs
  // in the browser, so it doesn't touch Node's real `process` during SSR.
  clientModules: ['./src/clientModules/processShim.ts'],

  plugins: [dedupeReactPlugin],

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
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: '⚡ Live Editor',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
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
      copyright: `Copyright © ${new Date().getFullYear()} jbpark · live-editor`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
