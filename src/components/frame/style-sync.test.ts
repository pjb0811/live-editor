// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { createStyleSyncManager, reconcileStyles } from './style-sync';

const createTarget = () => {
  const host = document.createElement('div');

  document.body.appendChild(host);

  return host.attachShadow({ mode: 'open' });
};

const syncedStyles = (target: Document | ShadowRoot) => [
  ...target.querySelectorAll('[data-live-editor-synced-style]'),
];

describe('reconcileStyles', () => {
  it('adds, updates, removes, and reorders source styles without touching injected styles', () => {
    const source = document.implementation.createHTMLDocument();
    const target = createTarget();
    const injected = document.createElement('style');
    const manager = createStyleSyncManager();

    injected.textContent = '.injected { color: green; }';
    target.appendChild(injected);
    source.head.innerHTML = `
      <style id="first">.first { color: red; }</style>
      <style id="second">.second { color: blue; }</style>
    `;

    reconcileStyles(source, target, manager, true);

    expect(syncedStyles(target).map(style => style.id)).toEqual([
      'first',
      'second',
    ]);
    expect(target.contains(injected)).toBe(true);

    const first = source.head.querySelector('#first')!;
    const second = source.head.querySelector('#second')!;
    first.textContent = '.first { color: purple; }';
    source.head.insertBefore(second, first);
    second.textContent = '.second { color: orange; }';

    reconcileStyles(source, target, manager, true);

    expect(syncedStyles(target).map(style => style.id)).toEqual([
      'second',
      'first',
    ]);
    expect(syncedStyles(target).map(style => style.textContent)).toEqual([
      '.second { color: orange; }',
      '.first { color: purple; }',
    ]);

    first.remove();
    reconcileStyles(source, target, manager, true);

    expect(syncedStyles(target).map(style => style.id)).toEqual(['second']);
    expect(target.contains(injected)).toBe(true);
  });

  it('keeps duplicate and colliding style contents as separate source nodes', () => {
    const source = document.implementation.createHTMLDocument();
    const target = createTarget();
    const manager = createStyleSyncManager();
    const first = source.createElement('style');
    const second = source.createElement('style');

    first.textContent = 'a'.repeat(50) + ' first';
    second.textContent = 'a'.repeat(50) + 'second';
    source.head.append(first, second);

    reconcileStyles(source, target, manager, true);

    expect(syncedStyles(target)).toHaveLength(2);
  });

  it('copies link attributes and removes managed clones when disabled', () => {
    const source = document.implementation.createHTMLDocument();
    const target = createTarget();
    const manager = createStyleSyncManager();
    const link = source.createElement('link');

    link.rel = 'stylesheet';
    link.href = '/theme.css';
    link.media = 'screen';
    link.setAttribute('disabled', '');
    source.head.appendChild(link);

    reconcileStyles(source, target, manager, true);

    const clone = syncedStyles(target)[0] as HTMLLinkElement;
    expect(clone.getAttribute('href')).toBe('/theme.css');
    expect(clone.media).toBe('screen');
    expect(clone.hasAttribute('disabled')).toBe(true);

    link.media = 'print';
    link.removeAttribute('disabled');
    reconcileStyles(source, target, manager, true);

    expect(syncedStyles(target)[0]).toBe(clone);
    expect(clone.media).toBe('print');
    expect(clone.hasAttribute('disabled')).toBe(false);

    reconcileStyles(source, target, manager, false);

    expect(syncedStyles(target)).toHaveLength(0);
  });

  it('syncs into an iframe document head and moves clones after a remount', () => {
    const source = document.implementation.createHTMLDocument();
    const firstTarget = document.implementation.createHTMLDocument();
    const secondTarget = document.implementation.createHTMLDocument();
    const manager = createStyleSyncManager();
    const style = source.createElement('style');

    style.textContent = '.preview { min-height: 100vh; }';
    source.head.appendChild(style);

    reconcileStyles(source, firstTarget, manager, true, content =>
      content.replace('100vh', '640px'),
    );

    expect(syncedStyles(firstTarget)).toHaveLength(1);
    expect(firstTarget.head.lastElementChild?.textContent).toBe(
      '.preview { min-height: 640px; }',
    );

    reconcileStyles(source, secondTarget, manager, true);

    expect(syncedStyles(firstTarget)).toHaveLength(0);
    expect(syncedStyles(secondTarget)).toHaveLength(1);
    expect(secondTarget.head.lastElementChild?.ownerDocument).toBe(
      secondTarget,
    );
  });
});
