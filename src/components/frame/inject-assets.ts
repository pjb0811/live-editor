import { convertViewportUnits } from './viewport-units';

// How many `<style>` and `<link>` elements the last sync left in the
// document, so a shorter list can remove the extras.
export interface InjectedCounts {
  styles: number;
  stylesheets: number;
}

// Gives each value its own element in the head, found again by
// `${idPrefix}${index}`, and removes the elements a shorter list leaves
// behind.
const syncInjectedElements = <T extends HTMLElement>(
  doc: Document,
  idPrefix: string,
  values: string[],
  previousCount: number,
  create: () => T,
  update: (el: T, value: string) => void,
) => {
  values.forEach((value, index) => {
    const id = `${idPrefix}${index}`;
    let el = doc.getElementById(id) as T | null;

    if (!el) {
      el = create();
      el.id = id;
      doc.head.appendChild(el);
    }

    update(el, value);
  });

  for (let index = values.length; index < previousCount; index++) {
    doc.getElementById(`${idPrefix}${index}`)?.remove();
  }
};

// Writes `styles` (CSS text) and `stylesheets` (URLs) into the document's
// head and returns the counts for the next call. Writes only what differs.
export const syncInjectedAssets = (
  doc: Document,
  styles: string[],
  stylesheets: string[],
  previous: InjectedCounts,
): InjectedCounts => {
  syncInjectedElements(
    doc,
    'injected-style-',
    styles,
    previous.styles,
    () => doc.createElement('style'),
    (styleEl, css) => {
      // The main source of `vh` units in a preview: compiled component CSS,
      // such as Tailwind's `h-screen`. See `ensureContainerStyle` in
      // `auto-height.ts` for why they're converted.
      const convertedCss = convertViewportUnits(css);

      if (styleEl.textContent !== convertedCss) {
        styleEl.textContent = convertedCss;
      }
    },
  );

  syncInjectedElements(
    doc,
    'injected-stylesheet-',
    stylesheets,
    previous.stylesheets,
    () => {
      const linkEl = doc.createElement('link');

      linkEl.rel = 'stylesheet';

      return linkEl;
    },
    (linkEl, href) => {
      if (linkEl.href !== href) {
        linkEl.href = href;
      }
    },
  );

  return { styles: styles.length, stylesheets: stylesheets.length };
};
