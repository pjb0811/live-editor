import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Default to node: the AST/pure-logic suites don't need a DOM and stay
    // fast this way. Component/hook tests opt into jsdom per file via a
    // `// @vitest-environment jsdom` docblock (see
    // src/components/context/states.test.tsx).
    environment: 'node',
    // Match `.test.tsx` too — the previous `*.test.ts`-only glob silently
    // collected nothing for `.test.tsx`, so a component test would report
    // "0 failures" while never actually running (#277).
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
