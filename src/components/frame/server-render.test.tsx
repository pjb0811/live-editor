// No DOM: rendered the way a server renders it (#716).
import { renderToString } from 'react-dom/server';

import { beforeEach, describe, expect, it } from 'vitest';

import Live from '~/index';
import { clearCompilationCache } from '~/utils/compile';

import { SERVER_CASES, SERVER_DOCUMENT, resetRuns, runs } from './server-cases';

beforeEach(() => {
  // `compile()` caches by code, and a cached module doesn't run again.
  clearCompilationCache();
  resetRuns();
});

describe('server rendering', () => {
  it.each(SERVER_CASES)(
    '$name renders without a document',
    ({ tree, rendersOnServer }) => {
      const html = renderToString(<Live>{tree()}</Live>);

      expect(html.includes('id="previewed"')).toBe(rendersOnServer);
      // Code is compiled and run only where its output reaches the HTML.
      expect(runs()).toBe(rendersOnServer ? 1 : 0);
    },
  );

  it('renders Live.Editor', () => {
    expect(() =>
      renderToString(
        <Live>
          <Live.Editor value={SERVER_DOCUMENT} />
        </Live>,
      ),
    ).not.toThrow();
  });
});
