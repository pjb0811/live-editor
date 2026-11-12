import { describe, expect, it } from 'vitest';

import {
  isFunctionExpressionSource,
  isFunctionSource,
} from './function-source';

// [source, function expression, function source]
describe('function sources (#741)', () => {
  it.each([
    ['() => {}', true, true],
    ['async (e) => console.log(e)', true, true],
    ['function () {}', true, true],
    ['function named() {}', true, true],
    ['async function* gen() {}', true, true],
    ['(() => {}) as Handler', true, true],
    ['(() => {}) satisfies Handler', true, true],
    ['handleClick', false, true],
    ['this.handle', false, true],
    ['actions.open', false, true],
    ['a.b.c', false, true],
    ['handleClick!', false, true],
    ['undefined', false, false],
    ["alert('x')", false, false],
    ['fn.bind(this)', false, false],
    ['a?.b', false, false],
    ['a[b]', false, false],
    ['ok ? a : b', false, false],
    ['42', false, false],
    ["'text'", false, false],
    ['<Button />', false, false],
    ['new Handler()', false, false],
    ['(a, b)', false, false],
    ['() => {', false, false],
    ['', false, false],
    ['   ', false, false],
  ])('%j', (source, expression, reference) => {
    expect(isFunctionExpressionSource(source)).toBe(expression);
    expect(isFunctionSource(source)).toBe(reference);
  });
});
