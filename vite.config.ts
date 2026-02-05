import react from '@vitejs/plugin-react';
import { URL, fileURLToPath } from 'node:url';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      rollupTypes: true,
      tsconfigPath: './tsconfig.app.json',
    }),
  ],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)), // Alias for the 'src' directory
    },
  },
  define: {
    'process.env': {},
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.tsx'),
        utils: resolve(__dirname, 'src/utils/index.ts'),
        'utils/ast': resolve(__dirname, 'src/utils/ast/index.ts'),
        'utils/tailwind': resolve(__dirname, 'src/utils/tailwind/index.ts'),
      },
      name: 'live-editor',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        exports: 'named',
      },
    },
  },
});
