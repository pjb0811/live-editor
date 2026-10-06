import { describe, expect, it } from 'vitest';

import {
  computeProbeHeight,
  isAnimationActive,
  isVisuallyHidden,
  positionedElementBottom,
  verticalInsets,
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

describe('verticalInsets (#440)', () => {
  const none = {
    marginTop: '0px',
    marginBottom: '0px',
    borderTopWidth: '0px',
    borderBottomWidth: '0px',
    paddingTop: '0px',
    paddingBottom: '0px',
  };

  it('adds margin, border and padding on both sides', () => {
    expect(
      verticalInsets({
        marginTop: '12px',
        marginBottom: '8px',
        borderTopWidth: '2px',
        borderBottomWidth: '2px',
        paddingTop: '4px',
        paddingBottom: '4px',
      }),
    ).toBe(32);
  });

  it('counts a margin on its own', () => {
    expect(verticalInsets({ ...none, marginTop: '12px' })).toBe(12);
  });

  it('keeps fractional values', () => {
    expect(verticalInsets({ ...none, marginBottom: '0.5px' })).toBe(0.5);
  });

  it('treats a value that does not parse as zero', () => {
    expect(verticalInsets({ ...none, marginTop: 'auto' })).toBe(0);
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

  it('treats an animating opacity:0 element as visible (#374)', () => {
    expect(
      isVisuallyHidden({ visibility: 'visible', opacity: '0' }, true),
    ).toBe(false);
  });

  it('keeps visibility:hidden hidden even while animating (#374)', () => {
    expect(isVisuallyHidden({ visibility: 'hidden', opacity: '1' }, true)).toBe(
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

describe('isAnimationActive (#374)', () => {
  it('counts a running animation', () => {
    expect(isAnimationActive('running')).toBe(true);
  });

  it('counts a paused animation — stopped part-way, not dismissed', () => {
    expect(isAnimationActive('paused')).toBe(true);
  });

  it('does not count a finished animation', () => {
    // The `animation-fill-mode: forwards` case: a completed fade-out holds
    // opacity:0 in `finished`, and that element is hidden for good.
    expect(isAnimationActive('finished')).toBe(false);
  });

  it('does not count an idle animation', () => {
    expect(isAnimationActive('idle')).toBe(false);
  });
});

describe('positionedElementBottom (#565)', () => {
  it('reads the bottom edge, so `top` and transforms count', () => {
    expect(positionedElementBottom(250, 550, 1000)).toBe(550);
  });

  it('reaches the bottom for an element pinned there, such as a bottom drawer', () => {
    expect(positionedElementBottom(500, 1000, 1000)).toBe(1000);
  });

  it('caps the bottom at probeHeight, so one element cannot stretch the preview', () => {
    expect(positionedElementBottom(500, 2500, 800)).toBe(800);
  });

  it('skips an element entirely below the viewport', () => {
    expect(positionedElementBottom(800, 1200, 800)).toBeNull();
  });

  it('skips an element entirely above the viewport', () => {
    expect(positionedElementBottom(-300, 0, 800)).toBeNull();
  });

  it('counts an element partly above the viewport by its visible bottom', () => {
    expect(positionedElementBottom(-100, 200, 800)).toBe(200);
  });
});
