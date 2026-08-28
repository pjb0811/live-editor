import { useMemo } from 'react';

import type { Module } from '~/types';
import { baseModules, compile } from '~/utils';

// Shared by `preview/client.tsx` and `dnd/renderer.tsx`, which both turn a
// code string into a renderable component in exactly the same way. They used
// to implement this separately, which is how the two paths drifted apart on
// error handling (see #246).
//
// Returns `null` for empty code so a caller can tell "nothing to render"
// apart from "compiled, but failed" — the latter is a Module carrying
// `error`, which callers should surface rather than render as blank.
export const useCompiledModule = (
  code: string,
  modules?: Record<string, unknown>,
): Module | null => {
  const mergedModules = useMemo(
    () => ({ ...baseModules, ...modules }),
    [modules],
  );

  return useMemo(() => {
    if (!code) {
      return null;
    }

    try {
      return compile(code, mergedModules);
    } catch (e) {
      return {
        exports: {},
        error: e instanceof Error ? e.message : 'Module transformation error',
      };
    }
  }, [code, mergedModules]);
};
