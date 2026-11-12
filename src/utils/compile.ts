import React from 'react';

import * as Babel from '@babel/standalone';

import type { Module } from '~/types';

import { CONFIG } from '../constants';
import { createBoundedCache } from './cache';
import { registerEditorCache } from './editor-caches';

interface CompilationKey {
  code: string;
  modules: [string, unknown][];
}

// The keys still in the LRU. Comparing at most `CACHE_LIMIT` of them avoids
// keeping every module object ever seen, or serializing modules, which can be
// cyclic or closures.
const compilationKeys = new Set<CompilationKey>();
const compilationCache = createBoundedCache<CompilationKey, Module>(
  CONFIG.CACHE_LIMIT,
  key => compilationKeys.delete(key),
);

const createCacheKey = (
  code: string,
  modules: Record<string, unknown>,
): CompilationKey => ({
  code,
  modules: Object.keys(modules)
    .sort()
    .map(name => [name, modules[name]]),
});

// Objects/functions compare by reference; primitives compare by value.
// Replace a module object when its implementation changes. In-place edits
// inside an existing module are intentionally not observed by this cache.
export const compile = (
  code: string,
  modules: Record<string, unknown>,
): Module => {
  const candidate = createCacheKey(code, modules);

  for (const key of compilationKeys) {
    if (
      key.code === candidate.code &&
      key.modules.length === candidate.modules.length &&
      key.modules.every(
        ([name, value], index) =>
          name === candidate.modules[index]![0] &&
          Object.is(value, candidate.modules[index]![1]),
      )
    ) {
      return compilationCache.get(key)!;
    }
  }

  const result = compileModule(code, Object.fromEntries(candidate.modules));

  compilationCache.set(candidate, result);
  compilationKeys.add(candidate);

  return result;
};

// `compilationKeys` needs no separate pass: it is drained by the `onEvict`
// the cache was built with, which `clear()` runs for every entry.
export const clearCompilationCache = () => {
  compilationCache.clear();
};

// JSX compiles to `React.createElement` (the classic runtime). The module runs
// with `React` in scope and has no `react/jsx-runtime` to import.
const REACT_PRESET: [string, object] = ['react', { runtime: 'classic' }];

const FILENAME = 'preview.tsx';

// Transforms JSX and TypeScript with `@babel/standalone`'s presets, without
// the `typescript` package (#192). Babel works per file without types, so a
// `const enum` becomes a real enum and legacy decorators aren't supported.
//
// Every document goes through the TypeScript preset: it accepts plain
// JavaScript too, and guessing which one a document is let common TypeScript
// through as JavaScript (#713). There is no `env` preset: the browsers React
// 19 runs in support the syntax as written, and lowering it to ES5 slowed
// every compile (#717). Only the module transform is needed, for `require`
// and `exports`.
const transformCode = (code: string): string =>
  Babel.transform(code, {
    filename: FILENAME,
    presets: ['typescript', REACT_PRESET],
    sourceType: 'module',
    plugins: [Babel.availablePlugins['transform-modules-commonjs']],
  })?.code || '';

// Babel's message names the problem and its position, with a code frame
// under it. The filename it starts with is ours, not the author's (#720).
const describeTransformError = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)).replace(
    /^\/?preview\.tsx: /,
    '',
  );

const compileModule = (
  code: string,
  modules: Record<string, unknown>,
): Module => {
  type RenderFunction = (
    exports: Module['exports'],
    require: (name: string) => unknown,
    module: Module,
    React: typeof import('react'),
  ) => void;

  let transformed: string;

  // A failed transform reports Babel's error. Handing the source to
  // `new Function` instead reported that one, which doesn't say what's
  // wrong (#720).
  try {
    transformed = transformCode(code);
  } catch (e) {
    return { exports: {}, error: describeTransformError(e) };
  }

  let render: RenderFunction;

  // Runs in this window's own JS realm, not inside the preview iframe — the iframe only
  // renders the resulting React elements via portal. See README "Security Notes".
  try {
    render = new Function(
      'exports',
      'require',
      'module',
      'React',
      transformed,
    ) as RenderFunction;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Syntax error';
    return { exports: {}, error: errorMessage };
  }

  const module: Module = { exports: {} };

  const customRequire = (name: string) => {
    if (name === 'react') {
      return React;
    }

    // Check presence, not truthiness: a module can be a falsy value (`0`, `''`,
    // `false`, `null`).
    if (name in modules) {
      return modules[name];
    }

    throw new Error(`Module not found: ${name}`);
  };

  try {
    render(module.exports, customRequire, module, React);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Runtime error';
    return { exports: {}, error: errorMessage };
  }

  return module;
};

registerEditorCache(clearCompilationCache);
