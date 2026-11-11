// @vitest-environment jsdom
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import Live from '~/index';
import { clearCompilationCache } from '~/utils/compile';

import { SERVER_CASES } from './server-cases';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

// The server's HTML: rendered with no `document`, as on a server.
const serverHTML = (tree: React.ReactNode) => {
  vi.stubGlobal('document', undefined);

  try {
    return renderToString(tree);
  } finally {
    vi.unstubAllGlobals();
  }
};

// Whether the previewed markup is in the page, its iframe or its shadow root.
const hasPreview = (root: HTMLElement) =>
  Boolean(root.querySelector('#previewed')) ||
  [...root.querySelectorAll('iframe')].some(frame =>
    frame.contentDocument?.querySelector('#previewed'),
  ) ||
  [...root.querySelectorAll('*')].some(node =>
    node.shadowRoot?.querySelector('#previewed'),
  );

describe('hydrating the server HTML (#716)', () => {
  it.each(SERVER_CASES)(
    '$name hydrates without a mismatch',
    async ({ tree }) => {
      clearCompilationCache();

      const container = document.createElement('div');

      container.innerHTML = serverHTML(<Live>{tree()}</Live>);
      document.body.appendChild(container);

      const problems: string[] = [];
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation((...args) => {
          problems.push(args.map(String).join(' '));
        });

      let root: ReturnType<typeof hydrateRoot> | undefined;

      await act(async () => {
        root = hydrateRoot(container, <Live>{tree()}</Live>, {
          onRecoverableError: error => {
            problems.push(String(error));
          },
        });
        // An iframe's document loads after a task.
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(problems.filter(problem => /hydrat|match/i.test(problem))).toEqual(
        [],
      );
      expect(hasPreview(container)).toBe(true);

      consoleError.mockRestore();
      await act(async () => root?.unmount());
    },
  );
});
