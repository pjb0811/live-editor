import { bench, describe } from 'vitest';

import {
  generateSectionPreview,
  generateSectionPreviews,
  getSections,
  parseDocument,
} from './document';

// Regression guard for the perf claims made in document.ts's parse cache
// (introduced in #80, reworked in #96/#97): a cache hit here no longer
// clones (#96 made parseDocument's result read-only, so callers can safely
// share it), so it should stay far cheaper than a fresh parse at every size
// below — that gap used to nearly vanish at real section counts back when
// this cache still cloned on every hit (see issue #95).
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

    bench('parseDocument (cache hit)', () => {
      parseDocument(code);
    });

    bench('getSections', () => {
      getSections(parseDocument(code)!);
    });

    bench('generateSectionPreview', () => {
      generateSectionPreview(code, firstSectionCode);
    });

    // Before #97, dnd.tsx called generateSectionPreview once per section
    // per render regardless of which one actually changed — this is that
    // N-calls pattern, compared below against the batched replacement.
    const allSectionCodes = getSections(parseDocument(code)!).map(s => s.code);

    bench(
      'one generateSectionPreview call per section (pre-#97 pattern)',
      () => {
        allSectionCodes.map(sectionCode =>
          generateSectionPreview(code, sectionCode),
        );
      },
    );

    bench(
      'generateSectionPreviews (batched, one call for all sections)',
      () => {
        generateSectionPreviews(code, allSectionCodes);
      },
    );
  });
}
