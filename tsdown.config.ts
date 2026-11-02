import { bundleAsync } from 'lightningcss';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'tsdown';

const require = createRequire(import.meta.url);

// `@jbpark/live-editor/ui-kit/style.css`: ui-kit's stylesheet in the
// `ui-kit` layer, for hosts that turn on the ui-kit entry. A separate file,
// so the default `style.css` carries none of it.
const buildUiKitStyle = async () => {
  const { code } = await bundleAsync({
    filename: 'src/components/ui-kit/style.css',
    resolver: {
      resolve: (specifier, from) =>
        specifier.startsWith('.')
          ? path.resolve(path.dirname(from), specifier)
          : require.resolve(specifier),
    },
  });

  await mkdir('dist/ui-kit', { recursive: true });
  await writeFile('dist/ui-kit/style.css', code);
};

export default defineConfig({
  // Object form (rather than an array) so each key controls its own output
  // path/subpath — matching package.json's `exports` map — regardless of
  // where the source file actually lives under src/components/. The root
  // entry stays for convenience/backwards compatibility; the rest let a
  // consumer who only needs e.g. Dnd avoid pulling in CodeMirror/Prettier
  // for Editor, or the whole editor stack for Preview. See #194.
  entry: {
    index: 'src/index.tsx',
    'provider/index': 'src/components/context/index.ts',
    'dnd/index': 'src/components/dnd/index.ts',
    'editor/index': 'src/components/editor/index.ts',
    'preview/index': 'src/components/preview/index.ts',
    'error/index': 'src/components/error/index.ts',
    'utils/index': 'src/utils/index.ts',
    'utils/ast/index': 'src/utils/ast/index.ts',
    'utils/tailwind/index': 'src/utils/tailwind/index.ts',
    'ui-kit/index': 'src/components/ui-kit/index.ts',
  },
  format: ['esm'],
  // This is a browser UI library (React components, iframe preview). Without
  // an explicit browser platform, bundled deps resolve their Node conditions
  // — e.g. nanoid pulls in `crypto.randomFillSync` and CJS interop injects
  // `createRequire` from `node:module` — which breaks every browser bundler
  // that consumes the built package (rspack/webpack throw on `node:` schemes).
  platform: 'browser',
  // `platform: 'browser'` only controls export-condition resolution, not
  // `process.env` substitution. Bundled deps can read `process.env.NODE_ENV`;
  // replace it at build time so a consumer whose bundler doesn't define
  // `process` doesn't crash on import with "process is not defined" (#278).
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  css: {
    // Vite's default build target (`baseline-widely-available`), so the
    // chrome's nested CSS reaches browsers without native nesting flattened.
    target: ['chrome107', 'edge107', 'firefox104', 'safari16'],
  },
  dts: { build: true },
  hooks: {
    'build:done': buildUiKitStyle,
  },
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  treeshake: true,
  deps: {
    onlyBundle: [
      /^@babel\//,
      /^@jridgewell\//,
      'clsx',
      'js-tokens',
      'jsesc',
      'nanoid',
      'obug',
      'picocolors',
      'tailwind-merge',
    ],
  },
});
