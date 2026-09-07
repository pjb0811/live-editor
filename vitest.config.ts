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
    // @jbpark/ui-kit ships CSS side-effect imports (e.g. swiper.css). Left
    // externalized, Node's ESM loader throws "Unknown file extension .css";
    // inlining routes it through Vite so the CSS resolves to an empty module.
    // Needed by any hook/component test that reaches ui-kit via ~/utils.
    server: {
      deps: {
        inline: [/@jbpark\/ui-kit/],
      },
    },
  },
});
