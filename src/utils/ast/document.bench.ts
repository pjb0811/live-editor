import { bench, describe } from 'vitest';

import { generateSectionPreview, getSections, parseDocument } from './document';

// Regression guard for the perf claims made in document.ts's parse cache
// (introduced in #80): whether cache-hit cloning actually beats a fresh
// re-parse depends heavily on document size, and doesn't hold at the
// section counts a real editor sees (see issue #95). Run via `pnpm bench`
// and compare `parseDocument (cache hit, clone)` against
// `parseDocument (no cache, fresh parse)` at each size below before relying
// on that cache providing a speedup.
const buildDocument = (sectionCount: number): string => {
  const sections = Array.from(
    { length: sectionCount },
    (_, i) => `
      <section data-name="Section ${i}">
        <div
          data-id="s${i}"
          data-binding="[{label:'Title',property:'innerText'}]"
        >
          <h2>Title ${i}</h2>
          <p>Description for section ${i}</p>
        </div>
      </section>`,
  ).join('\n');

  return `
import * as ui from 'ui-kit';

const App = () => {
  return (
    <main id="app-container">
      ${sections}
    </main>
  )
}

export default App;
`;
};

const SECTION_COUNTS = [5, 20, 50];

for (const sectionCount of SECTION_COUNTS) {
  const code = buildDocument(sectionCount);
  const firstSectionCode = getSections(parseDocument(code)!)[0]!.code;

  describe(`document.ts @ ${sectionCount} sections`, () => {
    // tinybench's setup/teardown hooks run per measurement *cycle*, not per
    // call, so they can't reliably force a cache miss on every single
    // invocation. Appending a per-call counter to the source instead
    // guarantees a unique cache key every time — a real re-parse each call,
    // and (as a bonus) a fair stand-in for "the user is typing, so the
    // source string is different on every edit" in practice.
    let freshParseCounter = 0;

    bench('parseDocument (no cache, fresh parse)', () => {
      parseDocument(`${code}\n// ${freshParseCounter++}`);
    });

    bench('parseDocument (cache hit, clone)', () => {
      parseDocument(code);
    });

    bench('getSections', () => {
      getSections(parseDocument(code)!);
    });

    // What Renderer actually pays once per <section> per render — see #97.
    bench('generateSectionPreview', () => {
      generateSectionPreview(code, firstSectionCode);
    });
  });
}
