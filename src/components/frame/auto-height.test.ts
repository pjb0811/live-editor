// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { getProbeHeight } from './auto-height';
import { FALLBACK_PROBE_HEIGHT } from './measure';

// jsdom has no layout, so `clientHeight` is 0 until a test sets it.
const setClientHeight = (el: HTMLElement, height: number) =>
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    value: height,
  });

describe('getProbeHeight', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const mount = (html: string) => {
    document.body.innerHTML = html;

    return {
      container: document.querySelector<HTMLElement>('[data-frame-container]'),
      iframe: document.querySelector('iframe')!,
    };
  };

  it('uses the fallback when there is no scroll container', () => {
    const { iframe } = mount('<div><iframe></iframe></div>');

    expect(getProbeHeight(iframe, window)).toBe(FALLBACK_PROBE_HEIGHT);
  });

  it('returns null while the scroll container has no height yet', () => {
    const { iframe } = mount(
      '<div data-frame-container><iframe></iframe></div>',
    );

    expect(getProbeHeight(iframe, window)).toBeNull();
  });

  it('subtracts the container padding and every wrapper between it and the iframe', () => {
    const { container, iframe } = mount(
      `<div data-frame-container style="padding: 10px 0">
        <div style="margin: 5px 0; border: 2px solid; padding: 3px 0"><iframe style="margin: 1px 0; border: 0"></iframe></div>
      </div>`,
    );

    setClientHeight(container!, 500);

    // Container padding 20, wrapper 2 * (5 + 2 + 3) = 20, iframe margin 2.
    expect(getProbeHeight(iframe, window)).toBe(500 - 20 - 20 - 2);
  });
});
