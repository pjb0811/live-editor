import { describe, expect, it } from 'vitest';

// The dnd entry, as a custom panel imports it.
import { isBindingVisible } from '..';
import type { PanelBinding } from '../panel-binding';
import { readDescription, readGroup } from './binding-meta';

type Binding = Parameters<typeof isBindingVisible>[0];

const field = (override: Partial<PanelBinding> = {}): Binding => ({
  id: 'el',
  property: 'href',
  value: '',
  ...override,
});

const mode = (value: unknown, override: Partial<PanelBinding> = {}) =>
  field({ property: 'mode', value, ...override });

// The rule from the docs: `href` shows while `mode` is `url` (#753).
const href = (visible: unknown, override: Partial<PanelBinding> = {}) =>
  field({ meta: { visible }, ...override });

const URL_RULE = { property: 'mode', in: ['url'], default: 'none' };

describe('isBindingVisible', () => {
  it('shows a field with no rule, or visible: true', () => {
    expect(isBindingVisible(field(), [])).toBe(true);
    expect(isBindingVisible(href(true), [])).toBe(true);
  });

  it('hides a field with visible: false', () => {
    expect(isBindingVisible(href(false), [])).toBe(false);
  });

  it('shows the field while the other binding holds a listed value', () => {
    const target = href(URL_RULE);

    expect(isBindingVisible(target, [mode('url'), target])).toBe(true);
    expect(isBindingVisible(target, [mode('none'), target])).toBe(false);
  });

  it('uses default while the attribute is absent', () => {
    const target = href({ ...URL_RULE, default: 'url' });

    expect(
      isBindingVisible(target, [mode('none', { present: false }), target]),
    ).toBe(true);
    // No binding for the property at all.
    expect(isBindingVisible(target, [target])).toBe(true);
    expect(isBindingVisible(href(URL_RULE), [href(URL_RULE)])).toBe(false);
  });

  it('reads another element through id', () => {
    const target = href({ ...URL_RULE, id: 'other' });

    expect(
      isBindingVisible(target, [mode('none'), mode('url', { id: 'other' })]),
    ).toBe(true);
    expect(
      isBindingVisible(target, [mode('url'), mode('none', { id: 'other' })]),
    ).toBe(false);
  });

  it('shows the field while any entry of an array value is listed', () => {
    const target = href(URL_RULE);

    expect(isBindingVisible(target, [mode(['a', 'url'])])).toBe(true);
    expect(isBindingVisible(target, [mode(['a', 'b'])])).toBe(false);
  });

  it.each([
    ['a string', 'no'],
    ['a number', 0],
    ['null', null],
    ['a rule without property', { in: ['url'] }],
    ['a rule whose in is not an array', { property: 'mode', in: 'url' }],
    ['a rule whose id is not a string', { property: 'mode', in: [], id: 1 }],
  ])('shows the field for %s', (_, visible) => {
    expect(isBindingVisible(href(visible), [mode('none')])).toBe(true);
  });
});

describe('readDescription and readGroup', () => {
  it('read text only', () => {
    expect(readDescription({ meta: { description: 'Help' } })).toBe('Help');
    expect(readDescription({ meta: { description: '  ' } })).toBeUndefined();
    expect(readDescription({ meta: { description: 1 } })).toBeUndefined();
    expect(readDescription({})).toBeUndefined();
    expect(readGroup({ meta: { group: 'Link' } })).toBe('Link');
    expect(readGroup({ meta: { group: true } })).toBeUndefined();
  });
});
