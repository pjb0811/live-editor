import React from 'react';

import * as Babel from '@babel/standalone';
import * as ui from '@jbpark/ui-kit';
import * as utils from '@jbpark/ui-kit/utils';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { Module, Section } from '~/types';

import { CONFIG, REGEX, TS_PATTERNS } from '../constants';
import {
  clearDocumentParseCache,
  createSectionPreviewCache,
  generateSectionPreview,
  generateSectionPreviews,
  getSections,
  parseDocument,
  replaceDocumentSections,
} from './ast/document';
import { clearExtractCache } from './ast/extract';
import { createBoundedCache } from './cache';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const baseModules = {
  'ui-kit': ui,
  'ui-kit/utils': utils,
};

interface CompilationKey {
  code: string;
  modules: [string, unknown][];
}

// The index holds only the keys still in the bounded LRU. Comparing at most
// CACHE_LIMIT snapshots avoids an unbounded identity registry for symbols
// or serializing module objects/functions (which may be cyclic or closures).
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
      plugins: [Babel.availablePlugins['transform-modules-commonjs']],
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

    // Presence, not truthiness: a module may legitimately *be* a falsy
    // primitive (`0`, `''`, `false`, `null`), which compile() supports and
    // compares by value. A truthiness check reported those as missing.
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

      return blobUrl;
    })
    // Cleanup belongs on both paths, not just the successful one. A rejected
    // promise left in this map is adopted by every later caller, so a single
    // failed fetch made that script unloadable for the rest of the session
    // even after the network recovered.
    .finally(() => {
      loadingScriptCache.delete(src);
    });

  loadingScriptCache.set(src, promise);

  return promise;
};

export const preloadScripts = (scripts: string[]): void => {
  scripts.forEach(src => {
    // Fire-and-forget by design, so the rejection is absorbed here rather
    // than surfacing as an unhandled one. The retry now works (see above),
    // and the real load path reports the failure to whoever awaits it.
    getCachedScriptBlob(src).catch(() => {});
  });
};

// Blob URLs are browser resources, not just memory, so dropping the entries
// is not enough — they have to be revoked. `clear()` runs the same `onEvict`
// the LRU does, so the `URL.revokeObjectURL` above covers this path too.
//
// `loadingScriptCache` goes with it: a promise from a session that no longer
// exists should not be adopted by the next one, which would otherwise hand
// back a blob URL created before the revocation.
export const clearScriptCache = () => {
  scriptCache.clear();
  loadingScriptCache.clear();
};

// The single place that knows the full set of editor-owned caches. A new
// cache added to the compile or AST pipeline needs adding here and nowhere
// else — the point of centralizing it is that the provider never has to
// learn about individual caches, which is how the previous arrangement
// (provider clearing the compilation cache and only that) drifted.
//
// Deliberately not exhaustive of every cache in the library: an instance
// from `createSectionPreviewCache` is owned by the component that holds it
// (`useState(() => createSectionPreviewCache())`), so it is already released
// with that component and there is nothing global to clear.
export const clearEditorCaches = () => {
  clearCompilationCache();
  clearDocumentParseCache();
  clearExtractCache();
  clearScriptCache();
};

// These caches are shared across every editor session in the page, so they
// can only be released once the *last* one is gone. Clearing on any single
// unmount would reach into siblings that are still mounted — harmless when
// the only casualty was a compilation cache (a cache miss costs time, not
// correctness), but not once revoking blob URLs is part of it: a sibling
// could be handed a URL that is dead before its iframe loads it.
let activeEditorSessions = 0;

// Returns the release function rather than exposing the counter, so a caller
// cannot release a session it never acquired. Idempotent, so React calling
// an effect's cleanup twice cannot drive the count negative.
export const registerEditorSession = (): (() => void) => {
  activeEditorSessions += 1;

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    activeEditorSessions -= 1;

    if (activeEditorSessions === 0) {
      clearEditorCaches();
    }
  };
};
