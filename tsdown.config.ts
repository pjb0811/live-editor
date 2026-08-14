import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.tsx',
    'src/utils/index.ts',
    'src/utils/ast/index.ts',
    'src/utils/tailwind/index.ts',
  ],
  format: ['esm'],
  dts: { build: true },
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  treeshake: true,
  deps: {
    onlyBundle: [
      /^@babel\//,
      /^@codemirror\//,
      /^@jridgewell\//,
      '@marijn/find-cluster-break',
      'clsx',
      'debug',
      'has-flag',
      'js-tokens',
      'jsesc',
      'ms',
      'nanoid',
      'picocolors',
      'style-mod',
      'supports-color',
      'tailwind-merge',
      'w3c-keyname',
    ],
  },
});
