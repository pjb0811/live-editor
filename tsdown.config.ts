import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.tsx',
  },
  outDir: 'dist',
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom', 'tailwindcss'],
  platform: 'browser',
  tsconfig: 'tsconfig.app.json',
});
