import { describe, expect, it } from 'vitest';

import { type ChildrenAction, getChildrenSignatures } from './children';
import { extract } from './extract';
import { update } from './update';

const binding = `data-id="parent" data-binding={[{label:'Children',property:'children'}]}`;
const first = `<p data-id='a' className = "keep">A {value}</p>`;
const second = `<p data-id="b">B</p>`;
const gap = ` text {/* keep */}{flag && <em>Conditional</em>} `;
const source = `<div ${binding}>${first}${gap}${second}</div>`;
const nodes = (code: string) => extract(code)[0]!.children!;

describe('children source preservation', () => {
  it('preserves expressions and unchanged source in legacy JSON reorder', () => {
    const result = update(
      source,
      'parent',
      'Children',
      JSON.stringify([...nodes(source)].reverse()),
      'children',
    );

    expect(result.success).toBe(true);
    expect(result.code).toBe(`<div ${binding}>${second}${gap}${first}</div>`);
  });
});

const command = (code: string, action: ChildrenAction) => ({
  kind: 'children-edit' as const,
  expected: getChildrenSignatures(nodes(code) ?? []),
  action,
});
const edit = (code: string, action: ChildrenAction) =>
  update(code, 'parent', 'Children', command(code, action), 'children');
const ids = (code: string) =>
  [...code.matchAll(/data-id=["']([^"']+)["']/g)].map(match => match[1]);

describe('children structural commands', () => {
  it('moves whole subtrees while leaving intervening source untouched', () => {
    const result = edit(source, { type: 'move', from: 0, to: 1 });

    expect(result.success).toBe(true);
    expect(result.code).toBe(`<div ${binding}>${second}${gap}${first}</div>`);
  });

  it('removes only the requested spans, including the last child', () => {
    const result = edit(source, { type: 'remove', indices: [0, 1] });

    expect(result.success).toBe(true);
    expect(result.code).toBe(`<div ${binding}>${gap}</div>`);
    const added = edit(result.code, { type: 'append' });

    expect(added.success).toBe(true);
    expect(added.code).toMatch(/<div data-id="[^"]+"><\/div><\/div>$/);
    expect(added.code).toContain(gap);
  });

  it('moves a selected group in source order', () => {
    const third = '<p data-id="c">C</p>';
    const code = `<div ${binding}>${first}${gap}${second}\n${third}</div>`;
    const result = edit(code, {
      type: 'move-selected',
      indices: [1, 2],
      direction: 'up',
    });

    expect(result.success).toBe(true);
    expect(result.code).toBe(
      `<div ${binding}>${second}${gap}${third}\n${first}</div>`,
    );
  });

  it.each(['duplicate', 'append'] as const)(
    'preserves copied source and gives every copied JSX node a fresh ID: %s',
    type => {
      const child = `<section {...props} data-id='a'><span data-id="nested">before {value} after</span>{flag && <em>Conditional</em>}{/* inside */}</section>`;
      const code = `<div ${binding}>${child}${gap}${second}</div>`;
      const result = edit(
        code,
        type === 'duplicate' ? { type, indices: [0] } : { type },
      );

      expect(result.success).toBe(true);
      const copied = result.code.slice(
        code.length - '</div>'.length,
        -'</div>'.length,
      );
      expect(result.code.startsWith(code.slice(0, -'</div>'.length))).toBe(
        true,
      );
      expect(copied.replace(/data-id="[^"]+"/g, 'data-id="NEW"')).toBe(
        `<section {...props} data-id="NEW"><span data-id="NEW">before {value} after</span>{flag && <em data-id="NEW">Conditional</em>}{/* inside */}</section>`,
      );
      expect(new Set(ids(result.code)).size).toBe(ids(result.code).length);
      expect(ids(copied)).toHaveLength(3);
    },
  );

  it('moves fragments without losing their mixed contents', () => {
    const fragment = `<>before {value}<span data-id="in">inside</span>{/* after */}</>`;
    const code = `<div ${binding}>${fragment}${gap}${second}</div>`;

    expect(edit(code, { type: 'move', from: 0, to: 1 }).code).toBe(
      `<div ${binding}>${second}${gap}${fragment}</div>`,
    );
  });

  it('rejects commands captured before a nested expression or ordering change', () => {
    const pending = command(source, { type: 'remove', indices: [0] });

    for (const current of [
      source.replace('{value}', '{nextValue}'),
      `<div ${binding}>${second}${gap}${first}</div>`,
    ]) {
      const result = update(current, 'parent', 'Children', pending, 'children');

      expect(result.success).toBe(false);
      expect(result.code).toBe(current);
      expect(result.failure).toMatchObject({
        reason: 'parse-error',
        error: new Error(
          'Unsupported or stale children edit; source was preserved',
        ),
      });
    }
  });

  it.each([
    { type: 'move', from: -1, to: 1 },
    { type: 'move', from: 0, to: 2 },
    { type: 'remove', indices: [0, 0] },
    { type: 'duplicate', indices: [9] },
    { type: 'move-selected', indices: [0], direction: 'sideways' },
  ])('refuses invalid indices/directions: $type', action => {
    const result = edit(source, action as ChildrenAction);

    expect(result.success).toBe(false);
    expect(result.code).toBe(source);
  });

  it.each([
    '<>{value}</>',
    '<></>',
    '<>{items.map(item => <p data-id={item.id}>{item.label}</p>)}</>',
  ])('refuses unmodeled fragments without losing source: %s', fragment => {
    const code = `<div ${binding}>${fragment}${second}</div>`;
    const result = edit(code, { type: 'remove', indices: [0] });

    expect(result.success).toBe(false);
    expect(result.code).toBe(code);
  });

  it('refuses to clone dynamic identities while still allowing source moves', () => {
    const code = `<div ${binding}><p data-id={key}>A</p>${second}</div>`;
    const result = edit(code, { type: 'duplicate', indices: [0] });

    expect(result.success).toBe(false);
    expect(result.code).toBe(code);
    expect(edit(code, { type: 'move', from: 0, to: 1 }).success).toBe(true);
  });

  it('refuses copying a spread that could override an explicit identity', () => {
    const code = `<div ${binding}><p data-id="a" {...props}>A</p></div>`;
    const result = edit(code, { type: 'duplicate', indices: [0] });

    expect(result.success).toBe(false);
    expect(result.code).toBe(code);
  });

  it('places a new identity after spreads on copied elements without an ID', () => {
    const code = `<div ${binding}><p {...props}>A</p></div>`;
    const result = edit(code, { type: 'append' });

    expect(result.success).toBe(true);
    expect(result.code).toMatch(
      /<p \{\.\.\.props\} data-id="[^"]+">A<\/p><\/div>$/,
    );
  });

  it('leaves cached extracted models unchanged', () => {
    const before = JSON.stringify(nodes(source));

    edit(source, { type: 'duplicate', indices: [0] });
    edit(source, { type: 'remove', indices: [1] });
    expect(JSON.stringify(nodes(source))).toBe(before);
  });
});

describe('legacy children compatibility', () => {
  it('allows modeled replacements when the old source is fully represented', () => {
    const code = `<div ${binding}><p data-id="a">A</p></div>`;
    const next = structuredClone(nodes(code));
    next[0]!.children![0]!.textContent = 'Updated';
    const result = update(
      code,
      'parent',
      'Children',
      JSON.stringify(next),
      'children',
    );

    expect(result.success).toBe(true);
    expect(result.code).toContain('>Updated</p>');
  });

  it('refuses regeneration of a lossy model', () => {
    const next = structuredClone(nodes(source));
    next[0]!.children![0]!.textContent = 'Updated';
    const result = update(
      source,
      'parent',
      'Children',
      JSON.stringify(next),
      'children',
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe(source);
  });

  it('rejects stale legacy source and duplicate identities', () => {
    const stale = JSON.stringify(nodes(source));
    const current = source.replace('{value}', '{nextValue}');
    expect(
      update(current, 'parent', 'Children', stale, 'children').success,
    ).toBe(false);
    const code = `<div ${binding}><p data-id="a">A</p></div>`;
    const repeated = JSON.stringify([...nodes(code), ...nodes(code)]);
    const result = update(code, 'parent', 'Children', repeated, 'children');

    expect(result.success).toBe(false);
    expect(result.code).toBe(code);
  });
});
