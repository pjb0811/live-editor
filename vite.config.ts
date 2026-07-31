import react from '@vitejs/plugin-react';
import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)), // Alias for the 'src' directory
    },
  },
  define: {
    'process.env': {},
  },
  server: {
    allowedHosts: ['.trycloudflare.com'],
  },
});
