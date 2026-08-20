import { describe, expect, it } from 'vitest';

import { generateTailwindCSSFromDOM } from './index';

// No DOM environment is configured for this project's vitest setup (see
// vitest.config.ts) — every other test here operates on plain data. Rather
// than pull in jsdom for this one function, fake the minimal `Element`
// surface it actually reads: `getAttribute('class')` on the root, and a
// single flat `querySelectorAll('[class]')` call for descendants.
const fakeRoot = (
  rootClass: string | null,
  descendantClasses: (string | null)[],
): Element => {
  const descendants = descendantClasses.map(cls => ({
    getAttribute: (name: string) => (name === 'class' ? cls : null),
  }));

  return {
    getAttribute: (name: string) => (name === 'class' ? rootClass : null),
    querySelectorAll: () => descendants,
  } as unknown as Element;
};

describe('generateTailwindCSSFromDOM', () => {
  it('compiles classes found on both the root and its descendants', async () => {
    const root = fakeRoot('flex', ['text-center', 'font-bold']);

    const css = await generateTailwindCSSFromDOM(root);

    expect(css).toContain('.flex');
    expect(css).toContain('.text-center');
    expect(css).toContain('.font-bold');
  });

  it('resolves theme-dependent utilities (colors, spacing, font sizes)', async () => {
    // Regression coverage for the bug where the compile context had no
    // theme loaded, so anything beyond keyword-only utilities (like
    // `text-center`) silently compiled to nothing.
    const root = fakeRoot(null, ['text-white', 'px-5', 'text-5xl']);

    const css = await generateTailwindCSSFromDOM(root);

    expect(css).toContain('--color-white');
    expect(css).toContain('--spacing');
    expect(css).toContain('--text-5xl');
  });

  it('dedupes a class repeated across elements into one rule', async () => {
    const root = fakeRoot('flex', ['flex', 'flex']);

    const css = await generateTailwindCSSFromDOM(root);

    expect(css.match(/\.flex\s*\{/g)).toHaveLength(1);
  });

  it('returns an empty string when nothing has a class', async () => {
    const root = fakeRoot(null, [null, null]);

    expect(await generateTailwindCSSFromDOM(root)).toBe('');
  });

  it('ignores an unrecognized utility name without throwing', async () => {
    const root = fakeRoot(null, ['not-a-real-utility']);

    expect(await generateTailwindCSSFromDOM(root)).not.toContain('{');
  });
});
