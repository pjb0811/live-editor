import { bench, describe } from 'vitest';

import {
  createSectionPreviewCache,
  generateSectionPreview,
  generateSectionPreviews,
  getSections,
  parseDocument,
  replaceDocumentSections,
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

    // #106: documentCache's limit was shrunk from 50 (shared with the
    // compile cache) to 4 (see CONFIG.DOCUMENT_CACHE_LIMIT), since it holds
    // full Babel Files rather than compiled Modules/strings. This simulates
    // the actual access pattern a real edit produces — dnd.tsx's
    // extractSections() and generateSections() both call parseDocument() on
    // the *same* current value within one render, so only the
    // most-recently-edited version ever needs to be resident, not a long
    // tail of every version edited so far.
    let editCounter = 0;

    bench(
      'simulated edit: extractSections()+generateSections() lookup pattern',
      () => {
        const edited = `${code}\n// edit ${editCounter++}`;

        parseDocument(edited);
        parseDocument(edited);
      },
    );

    // #131: dnd.tsx recomputed every section's preview on every edit, even
    // though only the one field/section actually touched needs a new
    // preview string — the rest are still going to splice out
    // byte-identical to what they were. These two benches simulate the
    // *real* dnd.tsx data flow for one keystroke: the edited section's new
    // code is spliced into the full document first (replaceDocumentSections,
    // same as Dnd's own onChange), producing a brand new `fullCode` string
    // every call — so, unlike naively varying only the section-level code
    // while reusing the same `code` constant, `parseDocument(fullCode)`
    // genuinely misses its cache on every iteration for *both* benches
    // here, same as a real edit. What's being compared is only the N-splice
    // step after that shared, unavoidable parse.
    const baseSections = getSections(parseDocument(code)!).map(s => ({
      id: s.id,
      code: s.code,
    }));

    let recomputeEditCounter = 0;

    bench(
      'one section edited: generateSectionPreviews (recomputes every section)',
      () => {
        const editedCodes = baseSections.map((s, i) =>
          i === 0
            ? `${s.code}\n{/* edit ${recomputeEditCounter++} */}`
            : s.code,
        );
        const editedFullCode = replaceDocumentSections(code, editedCodes);

        generateSectionPreviews(editedFullCode, editedCodes);
      },
    );

    const cache = createSectionPreviewCache();
    cache.compute(code, baseSections); // prime it, like the first render
    let cacheEditCounter = 0;

    bench(
      'one section edited: createSectionPreviewCache (reuses the rest)',
      () => {
        const editedSections = baseSections.map((s, i) =>
          i === 0
            ? { ...s, code: `${s.code}\n{/* edit ${cacheEditCounter++} */}` }
            : s,
        );
        const editedFullCode = replaceDocumentSections(
          code,
          editedSections.map(s => s.code),
        );

        cache.compute(editedFullCode, editedSections);
      },
    );
  });
}
