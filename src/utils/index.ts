import React from 'react';

import * as Babel from '@babel/standalone';
import * as ui from '@jbpark/ui-kit';
import * as utils from '@jbpark/ui-kit/utils';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { Module, Section } from '~/types';

import { CONFIG, REGEX, TS_PATTERNS } from '../constants';
import {
  createSectionPreviewCache,
  generateSectionPreview,
  generateSectionPreviews,
  getSections,
  parseDocument,
  replaceDocumentSections,
} from './ast/document';
import { createBoundedCache } from './cache';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const baseModules = {
  'ui-kit': ui,
  'ui-kit/utils': utils,
};

const compilationCache = createBoundedCache<string, Module>(CONFIG.CACHE_LIMIT);

// Uses the raw code+moduleKeys string as the key rather than hashing it —
// a 32-bit hash (the previous approach) can collide between two genuinely
// different inputs, which would silently serve one code string's compiled
// Module for another. The bounded LRU cache already caps memory use, so
// there's no need to shrink the key itself.
const createCacheKey = (
  code: string,
  modules: Record<string, unknown>,
): string => {
  const moduleKeys = Object.keys(modules).sort().join(',');

  return code + '|' + moduleKeys;
};

export const compile = (
  code: string,
  modules: Record<string, unknown>,
): Module => {
  const cacheKey = createCacheKey(code, modules);

  if (compilationCache.has(cacheKey)) {
    return compilationCache.get(cacheKey)!;
  }

  const result = compileModule(code, modules);

  compilationCache.set(cacheKey, result);
  return result;
};

export const clearCompilationCache = () => {
  compilationCache.clear();
  console.log('🧹 Compilation cache cleared');
};

// TypeScript source used to go through `ts.transpileModule` and then this
// same Babel pass — a double transpile, and one that required an eagerly
// awaited top-level `import('typescript')` (a 3.4 MB chunk with none of the
// laziness a dynamic import would normally buy, since it was awaited at
// module scope). `@babel/standalone` already ships `preset-typescript` and
// already runs this exact pass for the non-TS case, so folding TS in here
// removes the `typescript` dependency entirely — see #192. Babel transpiles
// per-file with no type information, so `const enum` comes out as a real
// enum object and legacy decorators aren't supported; neither matters for
// previewing React components, and errors here already fall back to
// returning the input unchanged, same as compileTypeScript did.
export const transformCode = (code: string, isTypeScript = false): string => {
  try {
    const result = Babel.transform(code, {
      filename: isTypeScript ? 'preview.tsx' : 'preview.jsx',
      presets: isTypeScript ? ['typescript', 'env', 'react'] : ['env', 'react'],
      sourceType: 'module',
      plugins: [
        [Babel.availablePlugins['transform-modules-commonjs']],
        //
      ],
    }).code;
    return result || '';
  } catch (e) {
    console.error('❌ Babel transformation error:', e);
    return code;
  }
};

export const detectTypeScript = (code: string): boolean => {
  // Strip `import`/`export ... from '...'` lines first — aliasing via `as`
  // (`import * as ui from 'ui-kit'`, `import { Foo as Bar } from '...'`) is
  // plain ES module syntax, not a TypeScript signal, but it otherwise
  // matches the `as\s+\w+` pattern below and made every piece of code look
  // like TypeScript.
  const withoutModuleLines = code.replace(REGEX.MODULE_IMPORT_EXPORT_LINE, '');

  return TS_PATTERNS.some(pattern => pattern.test(withoutModuleLines));
};

const compileModule = (
  code: string,
  modules: Record<string, unknown>,
): Module => {
  const isTypeScript = detectTypeScript(code);

  type RenderFunction = (
    exports: Module['exports'],
    require: (name: string) => unknown,
    module: Module,
    React: typeof import('react'),
  ) => void;

  let render: RenderFunction;

  // Runs in this window's own JS realm, not inside the preview iframe — the iframe only
  // renders the resulting React elements via portal. See README "Security Notes".
  try {
    render = new Function(
      'exports',
      'require',
      'module',
      'React',
      transformCode(code, isTypeScript),
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

    if (modules?.[name]) {
      return modules[name];
    }

    throw new Error(`모듈을 찾을 수 없음: ${name}`);
  };

  try {
    render(module.exports, customRequire, module, React);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : '런타임 에러';
    return { exports: {}, error: errorMessage };
  }

  return module;
};

export const extractSections = (code: string): Section[] => {
  const doc = parseDocument(code);

  return doc ? getSections(doc) : [];
};

export const replaceSections = (code: string, sections: string[]): string => {
  return replaceDocumentSections(code, sections);
};

export const generateSection = (code: string, fullCode: string) => {
  return generateSectionPreview(fullCode, code);
};

// Batched form of generateSection() — computes every section's preview from
// a single parse of fullCode instead of one parseDocument call per section
// (see generateSectionPreviews). Unchanged sections come back byte-identical
// to their previous preview string, which is what lets a caller pass each
// one down as a stable prop (see Renderer's React.memo).
export const generateSections = (
  codes: string[],
  fullCode: string,
): string[] => {
  return generateSectionPreviews(fullCode, codes);
};

// Incremental counterpart to generateSections() — see createSectionPreviewCache
// (#131). Pass a fresh instance's `compute` in place of generateSections()
// where the caller can keep it alive across renders (e.g. Dnd holds one via
// `useState(() => createSectionPreviewCache())`).
export { createSectionPreviewCache };
export type { SectionPreviewCache } from './ast/document';

const scriptCache = createBoundedCache<string, string>(
  CONFIG.SCRIPT_CACHE_LIMIT,
  (_src, blobUrl) => URL.revokeObjectURL(blobUrl),
);
const loadingScriptCache = new Map<string, Promise<string>>();

export const getCachedScriptBlob = async (src: string): Promise<string> => {
  const cached = scriptCache.get(src);

  if (cached) {
    return cached;
  }

  const existing = loadingScriptCache.get(src);

  if (existing) {
    return existing;
  }

  const promise = fetch(src)
    .then(res => res.text())
    .then(text => {
      const blob = new Blob([text], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);

      scriptCache.set(src, blobUrl);
      loadingScriptCache.delete(src);
      return blobUrl;
    });

  loadingScriptCache.set(src, promise);
  return promise;
};

export const preloadScripts = (scripts: string[]): void => {
  scripts.forEach(src => getCachedScriptBlob(src));
};
