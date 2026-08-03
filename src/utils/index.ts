import React from 'react';

import * as Babel from '@babel/standalone';
import * as ui from '@jbpark/ui-kit';
import * as utils from '@jbpark/ui-kit/utils';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type * as TS from 'typescript';

import type { Module, Section } from '~/types';

import { CONFIG, REGEX, TS_PATTERNS } from '../constants';

const ts = await import('typescript');

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const baseModules = {
  'ui-kit': ui,
  'ui-kit/utils': utils,
};

const compilationCache = new Map<string, Module>();

const simpleHash = (str: string): string => {
  let hash = 0;

  if (str.length === 0) {
    return '0';
  }

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(36);
};

const createCacheKey = (
  code: string,
  modules: Record<string, unknown>,
): string => {
  const moduleKeys = Object.keys(modules).sort().join(',');
  const combined = code + '|' + moduleKeys;

  return simpleHash(combined);
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

  if (compilationCache.size >= CONFIG.CACHE_LIMIT) {
    const firstKey = compilationCache.keys().next().value;

    if (firstKey) {
      compilationCache.delete(firstKey);
    }
  }

  compilationCache.set(cacheKey, result);
  return result;
};

export const clearCompilationCache = () => {
  compilationCache.clear();
  console.log('🧹 Compilation cache cleared');
};

const TS_COMPILER_OPTIONS: TS.CompilerOptions = {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.CommonJS,
  jsx: ts.JsxEmit.React,
  strict: false,
  esModuleInterop: true,
  skipLibCheck: true,
  declaration: false,
};

const compileTypeScript = (code: string): string => {
  try {
    const result = ts.transpileModule(code, {
      compilerOptions: TS_COMPILER_OPTIONS,
    });

    return result.outputText;
  } catch (e) {
    console.error('❌ TypeScript compilation error:', e);
    return code;
  }
};

export const transformCode = (code: string): string => {
  try {
    const result = Babel.transform(code, {
      presets: ['env', 'react'],
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
  return TS_PATTERNS.some(pattern => pattern.test(code));
};

const compileModule = (
  code: string,
  modules: Record<string, unknown>,
): Module => {
  const isTypeScript = detectTypeScript(code);
  const jsCode = isTypeScript ? compileTypeScript(code) : code;

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
      transformCode(jsCode),
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
  const cleanCode = code.replace(REGEX.COMMENT, '');
  const matches = [...cleanCode.matchAll(REGEX.SECTION)];

  return matches.map((m, i) => {
    const sectionCode = m[0];

    const dataNameMatch = sectionCode.match(REGEX.DATA_NAME);

    return {
      code: sectionCode,
      id: `${i}`,
      name: dataNameMatch?.[1] || `${i + 1}번째 컴포넌트`,
    };
  });
};

export const replaceSections = (code: string, sections: string[]): string => {
  const comments = [...code.matchAll(REGEX.COMMENT)].map(match => match[0]);

  const cleanCode = code.replace(REGEX.SECTION, '');
  const match = cleanCode.match(REGEX.CONTAINER);

  if (match) {
    const [, openTag, , closeTag] = match;
    const allContent = [...sections, ...comments].join('\n');

    return cleanCode.replace(
      REGEX.CONTAINER,
      `${openTag}\n${allContent}\n${closeTag}`,
    );
  }

  return code;
};

export const generateSection = (code: string, fullCode: string) => {
  const match = fullCode.match(REGEX.CONTAINER);

  if (!match) {
    return fullCode;
  }

  const [, openTag, , closeTag] = match;

  return fullCode.replace(REGEX.CONTAINER, `${openTag}\n${code}\n${closeTag}`);
};

const scriptCache = new Map<string, string>();
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

      if (scriptCache.size >= CONFIG.CACHE_LIMIT) {
        const firstKey = scriptCache.keys().next().value;

        if (firstKey) {
          const evictedUrl = scriptCache.get(firstKey);

          if (evictedUrl) {
            URL.revokeObjectURL(evictedUrl);
          }

          scriptCache.delete(firstKey);
        }
      }

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
