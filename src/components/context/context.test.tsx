// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The provider reaches ~/utils, which imports @jbpark/ui-kit for baseModules
// and so pulls in its CSS side effects. Stubbed out the same way
// src/utils/index.test.ts does.
vi.mock('@jbpark/ui-kit', () => ({}));
vi.mock('@jbpark/ui-kit/utils', () => ({}));

const { default: ContextProvider } = await import('./context');
const { clearEditorCaches, compile } = await import('~/utils');
const { parseDocument } = await import('~/utils/ast/document');

const DOC = `const App = () => (
  <main id="app-container">
    <section data-id="a" data-name="A"><p>a</p></section>
  </main>
);

export default App;`;
const COMPILE_CODE =
  "import { value } from 'fixture'; export default () => value;";

// The caches are only observable through the identity of what they hand back:
// same reference means the cached entry survived, a new one means it was
// released.
const primeCaches = () => {
  const fixture = { value: 1 };

  return {
    compiled: compile(COMPILE_CODE, { fixture }),
    parsed: parseDocument(DOC)!,
    recompile: () => compile(COMPILE_CODE, { fixture }),
  };
};

describe('ContextProvider cache ownership (#373)', () => {
  beforeEach(() => {
    clearEditorCaches();
  });

  it('releases every editor-owned cache when the provider unmounts', () => {
    const { unmount } = render(<ContextProvider />);
    const { compiled, parsed, recompile } = primeCaches();

    expect(recompile()).toBe(compiled);
    expect(parseDocument(DOC)!.ast).toBe(parsed.ast);

    unmount();

    expect(recompile()).not.toBe(compiled);
    // The parse cache is the one the provider never used to reach: before
    // this it only cleared the compilation cache, so a document's AST
    // outlived every session until the LRU happened to evict it.
    expect(parseDocument(DOC)!.ast).not.toBe(parsed.ast);
  });

  it('keeps the caches while a sibling provider is still mounted', () => {
    const first = render(<ContextProvider />);
    const second = render(<ContextProvider />);
    const { compiled, parsed, recompile } = primeCaches();

    first.unmount();

    expect(recompile()).toBe(compiled);
    expect(parseDocument(DOC)!.ast).toBe(parsed.ast);

    second.unmount();

    expect(recompile()).not.toBe(compiled);
    expect(parseDocument(DOC)!.ast).not.toBe(parsed.ast);
  });
});
