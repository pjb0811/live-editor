import { describe, expect, it } from 'vitest';

import { capDraftBump } from './draft-bump.mjs';

describe('capDraftBump', () => {
  it('lowers a major bump to minor and reports it', () => {
    expect(capDraftBump('major')).toEqual({ bump: 'minor', capped: true });
  });

  it.each(['minor', 'patch'])('passes %s through unchanged', bump => {
    expect(capDraftBump(bump)).toEqual({ bump, capped: false });
  });
});
