import { describe, expect, it } from 'vitest';

import { DEFAULT_TEMPLATE } from '../constants';
import {
  checkDocument,
  createDocument,
  extractSections,
  generateSections,
  replaceSections,
} from './sections';

const SECTION = '<section data-id="a" data-name="A"><p>a</p></section>';

// The public way to start a document `Live.Dnd` can add sections to (#449).
describe('createDocument', () => {
  it('matches the default template without options', () => {
    expect(createDocument()).toBe(DEFAULT_TEMPLATE);
  });

  it('builds a document the section helpers can edit, for any container id', () => {
    const empty = createDocument({ containerId: 'root' });

    expect(empty).toContain('<main id="root"></main>');
    expect(extractSections(empty, { containerId: 'root' })).toEqual([]);

    const withSection = replaceSections(empty, [SECTION], {
      containerId: 'root',
    });

    expect(
      extractSections(withSection, { containerId: 'root' }).map(s => s.id),
    ).toEqual(['a']);
    expect(
      generateSections([SECTION], withSection, { containerId: 'root' })[0],
    ).toContain(SECTION);
  });

  it('leaves a document alone when the container id does not match', () => {
    const empty = createDocument({ containerId: 'root' });

    expect(replaceSections(empty, [SECTION])).toBe(empty);
  });

  it.each(['', 'a b', 'x"y', '<main>', '{id}'])(
    'refuses %j as a container id',
    containerId => {
      expect(() => createDocument({ containerId })).toThrow(/containerId/);
    },
  );
});

// What a host checks before saving or loading a document (#522).
describe('checkDocument', () => {
  it('accepts a document Live.Dnd can edit, without exposing its AST', () => {
    expect(checkDocument(createDocument())).toEqual({ ok: true });
  });

  it('names a missing container', () => {
    expect(
      checkDocument(createDocument(), { containerId: 'elsewhere' }),
    ).toEqual({
      ok: false,
      reason: 'container-not-found',
      containerId: 'elsewhere',
    });
  });

  it('reports a syntax error', () => {
    const result = checkDocument('export default () => <main');

    expect(result).toMatchObject({ ok: false, reason: 'parse-error' });
  });

  it('returns a copy, so changing it leaves the shared cache alone', () => {
    const code = createDocument({ containerId: 'copy-check' });
    const first = checkDocument(code, { containerId: 'other' });

    Object.assign(first, { containerId: 'changed' });

    expect(checkDocument(code, { containerId: 'other' })).toMatchObject({
      containerId: 'other',
    });
  });
});
