import { describe, expect, it } from 'vitest';

import {
  computeProbeHeight,
  estimatePositionedElementHeight,
  isVisuallyHidden,
  parseTranslateY,
} from './measure';

describe('computeProbeHeight (#132 stage 2)', () => {
  it('returns clientHeight minus wrapper insets when positive', () => {
    expect(computeProbeHeight(600, 0)).toBe(600);
    expect(computeProbeHeight(600, 20)).toBe(580);
  });

  it('returns null when the scroll container has not been laid out yet', () => {
    expect(computeProbeHeight(0, 0)).toBeNull();
  });

  it('returns null when wrapper insets consume the entire client height', () => {
    expect(computeProbeHeight(50, 50)).toBeNull();
    expect(computeProbeHeight(50, 80)).toBeNull();
  });
});

describe('isVisuallyHidden (#132 stage 3)', () => {
  it('treats visibility:hidden as hidden', () => {
    expect(isVisuallyHidden({ visibility: 'hidden', opacity: '1' })).toBe(true);
  });

  it('treats opacity:0 as hidden', () => {
    expect(isVisuallyHidden({ visibility: 'visible', opacity: '0' })).toBe(
      true,
    );
  });

  it('treats a normally-visible element as not hidden', () => {
    expect(isVisuallyHidden({ visibility: 'visible', opacity: '1' })).toBe(
      false,
    );
  });

  it('is not fooled by a partial opacity', () => {
    expect(isVisuallyHidden({ visibility: 'visible', opacity: '0.01' })).toBe(
      false,
    );
  });
});

describe('parseTranslateY (#132 stage 3)', () => {
  it('reads the Y component of translate(x, y)', () => {
    expect(parseTranslateY('translate(10px, 24px)')).toBe(24);
  });

  it('reads a negative Y offset', () => {
    expect(parseTranslateY('translate(0px, -12px)')).toBe(-12);
  });

  it('reads translateY(y) alone', () => {
    expect(parseTranslateY('translateY(40px)')).toBe(40);
  });

  it('reads the ty component of matrix(a, b, c, d, tx, ty)', () => {
    expect(parseTranslateY('matrix(1, 0, 0, 1, 10, 50)')).toBe(50);
  });

  it('returns 0 for no transform', () => {
    expect(parseTranslateY('none')).toBe(0);
    expect(parseTranslateY('')).toBe(0);
  });

  it('returns 0 for an X-only translate rather than throwing', () => {
    expect(parseTranslateY('translateX(10px)')).toBe(0);
  });

  it('returns 0 for an unrecognized transform rather than throwing', () => {
    expect(parseTranslateY('rotate(45deg)')).toBe(0);
    expect(parseTranslateY('scale(1.5)')).toBe(0);
  });
});

describe('estimatePositionedElementHeight (#132 stage 3)', () => {
  it('adds the translateY offset to offsetHeight', () => {
    expect(
      estimatePositionedElementHeight(100, 'translate(0px, 50px)', 1000),
    ).toBe(150);
  });

  it('caps the estimate at probeHeight — a positioned element cannot inflate the document past one viewport', () => {
    expect(
      estimatePositionedElementHeight(2000, 'translate(0px, 500px)', 800),
    ).toBe(800);
  });

  it('is unaffected by transform when there is none', () => {
    expect(estimatePositionedElementHeight(300, 'none', 1000)).toBe(300);
  });

  it('does not cap when the estimate is already under probeHeight', () => {
    expect(
      estimatePositionedElementHeight(100, 'translate(0px, 20px)', 1000),
    ).toBe(120);
  });
});
