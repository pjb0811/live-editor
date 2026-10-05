import { useMemo } from 'react';

import { useLiveMessages } from '~/components/context/messages';
import type { Module } from '~/types';
import { compile } from '~/utils/compile';

import { baseModules } from './base-modules';
import { useStableModules } from './use-stable-modules';

// Compiles code into a component, for `Live.Preview` and each canvas
// section, so both handle errors the same way (#246). `null` for empty code,
// so a caller can tell "nothing to render" from a failed compile, which
// comes back as a module with `error`.
export const useCompiledModule = (
  code: string,
  _modules?: Record<string, unknown>,
): Module | null => {
  // An inline `modules` object from `Live.Preview`'s host is new each
  // render; only a changed entry should recompile (#397).
  const modules = useStableModules(_modules);
  const { unknown } = useLiveMessages().errors;

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
        error: e instanceof Error ? e.message : unknown,
      };
    }
  }, [code, mergedModules, unknown]);
};
