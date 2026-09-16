import * as t from '@babel/types';
import { describe, expect, it } from 'vitest';

import { getCurrentValue } from './binding';
import { extract } from './extract';
import {
  appendArrayItem,
  duplicateArrayItems,
  moveArrayItem,
  moveArrayItems,
  parseItems,
  removeArrayItems,
  updateArrayItemProperty,
  updateArrayItemValue,
} from './items';
import { update } from './update';
import { parseArrayExpression } from './value';

const sparse = `[, /* keep */ {label:'A'}, { label : 'B' },]`;

describe('array source fidelity', () => {
  it('retains original element positions when reading sparse arrays', () => {
    expect(parseItems(sparse)?.map(item => item.index)).toEqual([1, 2]);
  });

  it('changes only the selected property while preserving holes and siblings', () => {
    expect(updateArrayItemProperty(sparse, 1, 'label', 'Changed')).toBe(
      sparse.replace("'A'", '"Changed"'),
    );
  });
});

it('preserves raw array source through extract, item edit and JSX write-back', () => {
  const code = `<List data-id="list" data-binding={[{label:'Rows',property:'items'}]} items = { /* before */ ${sparse} /* after */ } />`;
  const raw = getCurrentValue(extract(code)[0]!, 'items');
  expect(raw).toBe(sparse);
  const next = updateArrayItemProperty(raw, 1, 'label', 'Changed')!;
  const result = update(code, 'list', 'Rows', next, 'items');

  expect(result.success).toBe(true);
  expect(result.code).toBe(code.replace("'A'", '"Changed"'));
});

it('edits a static item after a spread without changing spread or source positions', () => {
  const code = `[...rows, , {label:'A'}, /* unchanged */ {label:'B'},]`;

  expect(parseItems(code)?.map(item => item.index)).toEqual([2, 3]);
  expect(updateArrayItemProperty(code, 2, 'label', 'Changed')).toBe(
    code.replace("'A'", '"Changed"'),
  );
  expect(updateArrayItemValue(code, 0, 'anything')).toBeNull();
});

it.each([sparse, `[...rows, {label:'A'}, {label:'B'}]`, `[(1), 2]`])(
  'refuses structural changes on unsupported source: %s',
  code => {
    expect(moveArrayItem(code, 1, 0)).toBeNull();
    expect(moveArrayItems(code, new Set([1]), 'up')).toBeNull();
    expect(removeArrayItems(code, new Set([1]))).toBeNull();
    expect(duplicateArrayItems(code, new Set([1]))).toBeNull();
    expect(appendArrayItem(code, 'object')).toBeNull();
  },
);

it('moves raw expressions and JSX while keeping comment gaps and trailing comma', () => {
  const first = `{ key: 'a', child: <b data-id='x'>{value}</b>, value: fn(1, 2) }`;
  const second = `'literal,comma'`;
  const code = `[\n ${first}, /* keep, comma */\n ${second},\n]`;

  expect(moveArrayItem(code, 0, 1)).toBe(
    `[\n ${second}, /* keep, comma */\n ${first},\n]`,
  );
});

it('removes dense mixed items without rewriting survivors or deleting comments', () => {
  const code = `[ 1, /* keep */ {a:'A'}, // keep too\n 3, ]`;
  const next = removeArrayItems(code, new Set([1]));

  expect(next).toBe(`[ 1, /* keep */  // keep too\n 3, ]`);
  expect(parseArrayExpression(next!)?.elements).toHaveLength(2);
});

it.each([false, true])(
  'keeps all removal combinations valid (trailing comma: %s)',
  trailing => {
    const code = `[0, /* one */ 1, // two\n 2, 3${trailing ? ',' : ''}]`;

    for (let mask = 0; mask < 15; mask++) {
      const selected = new Set(
        [0, 1, 2, 3].filter(index => mask & (1 << index)),
      );
      const result = removeArrayItems(code, selected)!;
      const actual = parseArrayExpression(result)!.elements.map(node =>
        t.isNumericLiteral(node) ? node.value : null,
      );

      expect(actual).toEqual(
        [0, 1, 2, 3].filter(index => !selected.has(index)),
      );
      expect(result).toContain('/* one */');
      expect(result).toContain('// two\n');
    }
  },
);

it('copies exact nested source, changing only the copy identities', () => {
  const item = `{ key:'row', child:<b data-id='nested'>{flag && <i>keep</i>}</b>, ref:thing.value, data:[, 1], text:\`hello\` }`;
  const code = `[${item}, // tail\n]`;
  let count = 0;
  const result = duplicateArrayItems(
    code,
    new Set([0]),
    () => `copy${count++}`,
  )!;

  expect(result).toBe(
    `[${item}, ${item.replace("'nested'", '"copy0"').replace("'row'", '"row-copy1"')}, // tail\n]`,
  );
});

it.each([
  `[{child:<b data-id={id}/>}]`,
  `[{child:<b data-id="id" {...props}/>}]`,
  `[{key: getKey()}]`,
])('refuses copies with ambiguous identities: %s', code => {
  expect(duplicateArrayItems(code, new Set([0]))).toBeNull();
});

it('refuses an unsupported shorthand value instead of replacing its identifier', () => {
  expect(
    updateArrayItemProperty('[{ value, other: 2 }]', 0, 'value', 'new'),
  ).toBeNull();
});

it('keeps type wrappers and surrounding attribute comments during a value edit', () => {
  const raw = `[, {label:'A'}] as const`;
  const code = `<List data-id="list" data-binding={[{label:'Rows',property:'items',type:'array'}]} items={ /* before */ (${raw}) /* after */ } />`;
  const value = getCurrentValue(extract(code)[0]!, 'items');
  const next = updateArrayItemProperty(value, 1, 'label', 'New')!;
  const result = update(code, 'list', 'Rows', next, 'items');

  expect(result.success).toBe(true);
  expect(result.code).toBe(code.replace("'A'", '"New"'));
});

it('keeps newly supplied trailing line comments from consuming sibling syntax', () => {
  const next = updateArrayItemProperty(
    '[{rows:[1], keep:2}]',
    0,
    'rows',
    '[2] // keep comment',
  );

  expect(next).toBe('[{rows:[2] // keep comment\n, keep:2}]');
  expect(parseArrayExpression(next!)?.elements).toHaveLength(1);
});

it('refuses generated IDs that collide with existing or newly copied identities', () => {
  const code = `[{child:<b data-id="existing"/>}, {child:<b data-id="other"/>}]`;

  expect(duplicateArrayItems(code, new Set([0]), () => 'other')).toBeNull();
  expect(duplicateArrayItems(code, new Set([0, 1]), () => 'repeat')).toBeNull();
});
