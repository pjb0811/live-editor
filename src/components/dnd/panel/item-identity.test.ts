import { describe, expect, it } from 'vitest';

import {
  createIdentityState,
  moveId,
  reconcileIdentityState,
  removeIds,
} from './item-identity';

const items = (...sources: string[]) =>
  sources.map((source, index) => ({ id: `new-${index}`, source }));

describe('createIdentityState', () => {
  it('takes the ids and sources of the items', () => {
    expect(createIdentityState('v', 'object', items('a', 'b'))).toEqual({
      value: 'v',
      kind: 'object',
      ids: ['new-0', 'new-1'],
      signatures: ['a', 'b'],
    });
  });

  it('uses the ids it is given instead of the items', () => {
    const state = createIdentityState('v', 'object', items('a'), ['kept']);

    expect(state.ids).toEqual(['kept']);
  });
});

describe('reconcileIdentityState', () => {
  const start = createIdentityState('v1', 'object', items('a', 'b', 'c'));

  it('returns the same state when nothing changed', () => {
    expect(
      reconcileIdentityState(start, 'v1', 'object', items('a', 'b', 'c')),
    ).toBe(start);
  });

  it('starts over when there is no state yet', () => {
    const state = reconcileIdentityState(null, 'v1', 'object', items('a'));

    expect(state.ids).toEqual(['new-0']);
  });

  it('starts over when the kind changes', () => {
    const state = reconcileIdentityState(start, 'v2', 'primitive', items('a'));

    expect(state.ids).toEqual(['new-0']);
    expect(state.kind).toBe('primitive');
  });

  it('keeps the id of an item whose source is unique before and after a move', () => {
    const state = reconcileIdentityState(
      start,
      'v2',
      'object',
      items('c', 'a', 'b'),
    );

    expect(state.ids).toEqual(['new-2', 'new-0', 'new-1']);
  });

  it('gives an item with a changed source a new id', () => {
    const state = reconcileIdentityState(
      start,
      'v2',
      'object',
      items('a', 'B', 'c'),
    );

    expect(state.ids).toEqual(['new-0', 'new-1', 'new-2']);
    expect(state.signatures).toEqual(['a', 'B', 'c']);
  });

  it('gives items with the same source new ids, since they cannot be told apart', () => {
    const twins = createIdentityState('v1', 'object', items('a', 'a'));
    const state = reconcileIdentityState(
      twins,
      'v2',
      'object',
      items('a', 'a', 'b'),
    );

    expect(state.ids).toEqual(['new-0', 'new-1', 'new-2']);
  });
});

describe('moveId', () => {
  it('moves an id without changing the original array', () => {
    const ids = ['a', 'b', 'c'];

    expect(moveId(ids, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

describe('removeIds', () => {
  it('removes the ids at the given indices', () => {
    expect(removeIds(['a', 'b', 'c', 'd'], new Set([1, 3]))).toEqual([
      'a',
      'c',
    ]);
  });
});
