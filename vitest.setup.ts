import { afterEach } from 'vitest';

// Testing Library unmounts after each test by itself only when `afterEach` is
// a global, which it isn't here (`globals` is off). A tree left mounted keeps
// its observers, which then fire after jsdom is torn down (#654). Loaded only
// in a DOM environment, so the node suites don't import React.
afterEach(async () => {
  if (!('document' in globalThis)) {
    return;
  }

  const { cleanup } = await import('@testing-library/react');

  cleanup();
});
