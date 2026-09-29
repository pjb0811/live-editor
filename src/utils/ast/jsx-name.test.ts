import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { describe, expect, it } from 'vitest';

import { getSections, parseDocument } from './document';
import { extract } from './extract';
import { getJSXTagName } from './jsx-name';

const openingOf = (code: string) => {
  const node = parseExpression(code, { plugins: ['jsx'] });

  if (!t.isJSXElement(node)) {
    throw new Error(`not a JSX element: ${code}`);
  }

  return node.openingElement;
};

describe('getJSXTagName', () => {
  it.each([
    ['<section />', 'section'],
    ['<Button />', 'Button'],
    ['<ui.Space />', 'ui.Space'],
    ['<A.B.C />', 'A.B.C'],
    ['<svg:rect />', ''],
  ])('resolves %s to %j', (code, expected) => {
    expect(getJSXTagName(openingOf(code))).toBe(expected);
  });
});

// Section discovery and extraction used to resolve tag names separately, and
// only extraction understood member expressions (#444). Both go through
// `getJSXTagName` now, so they read the same name from the same element.
describe('tag names across pipeline steps', () => {
  const documentWith = (body: string) => `const App = () => (
  <main id="app-container">
    ${body}
  </main>
);

export default App;`;

  it('names a member-expression element the same way in extraction', () => {
    const [node] = extract(`<ui.Space data-id="space">x</ui.Space>`);

    expect(node!.tagName).toBe(getJSXTagName(openingOf('<ui.Space />')));
  });

  it('still finds only intrinsic <section> elements as sections', () => {
    const doc = parseDocument(
      documentWith(`
        <section data-id="a" data-name="A"><p>a</p></section>
        <ui.section data-id="b" data-name="B"><p>b</p></ui.section>`),
    );

    expect(getSections(doc!).map(section => section.id)).toEqual(['a']);
  });
});
