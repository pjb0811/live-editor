import { describe, expect, it } from 'vitest';

import { convertViewportUnits } from './viewport-units';

describe('convertViewportUnits (#132 stage 1)', () => {
  it.each([
    ['height: 100vh', 'height: 100cqh'],
    ['height: 100VH', 'height: 100cqh'],
    ['width: 50.5vh', 'width: 50.5cqh'],
    ['margin-top: -10vh', 'margin-top: -10cqh'],
  ])('converts vh: %s -> %s', (input, expected) => {
    expect(convertViewportUnits(input)).toBe(expected);
  });

  it.each([
    ['height: 100svh', 'height: 100cqh'],
    ['height: 100lvh', 'height: 100cqh'],
    ['height: 100dvh', 'height: 100cqh'],
    ['font-size: 5vmin', 'font-size: 5cqmin'],
    ['font-size: 5vmax', 'font-size: 5cqmax'],
  ])(
    'converts the svh/lvh/dvh/vmin/vmax family: %s -> %s',
    (input, expected) => {
      expect(convertViewportUnits(input)).toBe(expected);
    },
  );

  it.each([
    ['height: calc(100vh - 20px)', 'height: calc(100cqh - 20px)'],
    ['height: var(--x, 100vh)', 'height: var(--x, 100cqh)'],
    [
      'height: calc(var(--y, 50vh) + 10dvh)',
      'height: calc(var(--y, 50cqh) + 10cqh)',
    ],
  ])('converts inside calc()/var() nesting: %s -> %s', (input, expected) => {
    expect(convertViewportUnits(input)).toBe(expected);
  });

  it('converts every occurrence in a multi-declaration rule', () => {
    expect(convertViewportUnits('height: 100vh; max-height: 50vh;')).toBe(
      'height: 100cqh; max-height: 50cqh;',
    );
  });

  it.each([
    ['width: 100vw', 'width: 100vw'], // width-based, no circular reference to fix
    ['max-width: 50vw', 'max-width: 50vw'],
  ])('preserves vw (%s)', (input, expected) => {
    expect(convertViewportUnits(input)).toBe(expected);
  });

  it.each([
    ['--my-vh: 10px', '--my-vh: 10px'],
    ['--container-lvh-offset: 4px', '--container-lvh-offset: 4px'],
  ])('preserves custom property names (%s)', (input, expected) => {
    expect(convertViewportUnits(input)).toBe(expected);
  });

  it.each([
    ['background: url(a5vh.png)', 'background: url(a5vh.png)'],
    [
      'background: url(hero-100vh-bg.jpg)',
      'background: url(hero-100vh-bg.jpg)',
    ],
    ['.a5vh { color: red; }', '.a5vh { color: red; }'],
    ['.hero-100vh { color: red; }', '.hero-100vh { color: red; }'],
  ])(
    'preserves digits embedded in a URL or class name (%s)',
    (input, expected) => {
      expect(convertViewportUnits(input)).toBe(expected);
    },
  );

  it.each([
    ['height: 100vhx', 'height: 100vhx'],
    ['height: 100svhx', 'height: 100svhx'],
  ])(
    'preserves a unit-like suffix that continues past a real unit (%s)',
    (input, expected) => {
      expect(convertViewportUnits(input)).toBe(expected);
    },
  );

  it('leaves input with no viewport units completely unchanged', () => {
    const css = 'display: flex; padding: 10px 1rem; color: #fff;';
    expect(convertViewportUnits(css)).toBe(css);
  });

  // Known, documented limitation (inherited from the source fork): the
  // regex has no notion of CSS string quoting, so text that happens to
  // look like a viewport dimension inside a string literal gets rewritten
  // too. Pinning this down so it's a deliberate, visible trade-off instead
  // of a surprise if someone "fixes" it later without noticing why it was
  // this way.
  it('also converts inside a string literal (documented limitation, not a bug to fix here)', () => {
    expect(convertViewportUnits('content: "100vh"')).toBe('content: "100cqh"');
  });
});

// #163: the container-context fix only reaches CSS *text* this component
// injects. `rewriteInlineViewportUnits` extends it to two paths that carry a
// viewport unit into the preview document directly — inline `style` attributes
// and in-preview `<style>` tags — both of which convert via this same helper.
// Applying the rewrite over the live DOM is thin glue (like `updateHeight`
// itself) and, matching this repo's node test environment, is left untested at
// that layer; these lock in the string transform each path depends on, using
// the exact payloads the issue observed shipping unconverted.
describe('convertViewportUnits — #163 embedded-unit payloads', () => {
  it('converts an inline style attribute value (panel-edited hero)', () => {
    expect(convertViewportUnits('height: 100vh; background: salmon;')).toBe(
      'height: 100cqh; background: salmon;',
    );
  });

  it('converts a rule inside an in-preview <style> tag', () => {
    expect(convertViewportUnits('.hero{height:100vh;background:salmon}')).toBe(
      '.hero{height:100cqh;background:salmon}',
    );
  });
});
