import { describe, expect, it } from 'vitest';

import { moveSelectedIndices, removeIndices } from './selection';

describe('removeIndices', () => {
  it('removes the given indices and keeps the rest in order', () => {
    expect(removeIndices(['a', 'b', 'c', 'd'], new Set([1, 3]))).toEqual([
      'a',
      'c',
    ]);
  });

  it('returns the same list when no indices are selected', () => {
    expect(removeIndices(['a', 'b'], new Set())).toEqual(['a', 'b']);
  });
});

describe('moveSelectedIndices', () => {
  it('moves a single selected item up by one', () => {
    const result = moveSelectedIndices(['a', 'b', 'c'], new Set([1]), 'up');

    expect(result.items).toEqual(['b', 'a', 'c']);
    expect(result.indices).toEqual(new Set([0]));
  });

  it('moves a single selected item down by one', () => {
    const result = moveSelectedIndices(['a', 'b', 'c'], new Set([1]), 'down');

    expect(result.items).toEqual(['a', 'c', 'b']);
    expect(result.indices).toEqual(new Set([2]));
  });

  it('does not move past the start boundary', () => {
    const result = moveSelectedIndices(['a', 'b', 'c'], new Set([0]), 'up');

    expect(result.items).toEqual(['a', 'b', 'c']);
    expect(result.indices).toEqual(new Set([0]));
  });

  it('does not move past the end boundary', () => {
    const result = moveSelectedIndices(['a', 'b', 'c'], new Set([2]), 'down');

    expect(result.items).toEqual(['a', 'b', 'c']);
    expect(result.indices).toEqual(new Set([2]));
  });

  it('slides a scattered selection up together, preserving relative order', () => {
    // Select 'b' (1) and 'd' (3): moving up should stop 'b' at the top
    // (index 0) and pull 'd' up to sit right after it, without the two
    // swapping past each other or past unselected items incorrectly.
    const result = moveSelectedIndices(
      ['a', 'b', 'c', 'd', 'e'],
      new Set([1, 3]),
      'up',
    );

    expect(result.items).toEqual(['b', 'a', 'd', 'c', 'e']);
    expect(result.indices).toEqual(new Set([0, 2]));
  });

  it('slides a scattered selection down together, preserving relative order', () => {
    const result = moveSelectedIndices(
      ['a', 'b', 'c', 'd', 'e'],
      new Set([1, 3]),
      'down',
    );

    expect(result.items).toEqual(['a', 'c', 'b', 'e', 'd']);
    expect(result.indices).toEqual(new Set([2, 4]));
  });

  it('moves an already-contiguous block as a unit', () => {
    const result = moveSelectedIndices(
      ['a', 'b', 'c', 'd'],
      new Set([1, 2]),
      'up',
    );

    expect(result.items).toEqual(['b', 'c', 'a', 'd']);
    expect(result.indices).toEqual(new Set([0, 1]));
  });
});
