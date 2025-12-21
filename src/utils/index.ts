import React from 'react';

import * as Babel from '@babel/standalone';
import * as tanstackQuery from '@tanstack/react-query';
import * as useHooks from '@uidotdev/usehooks';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as ts from 'typescript';

import type { Dnd, Module } from '../types';

export const baseModules = {
  '@tanstack/react-query': tanstackQuery,
  '@uidotdev/usehooks': useHooks,
  '~/utils': {
    cn,
  },
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
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

  if (compilationCache.size >= 50) {
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

const TS_COMPILER_OPTIONS: ts.CompilerOptions = {
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
    console.log('TypeScript 컴파일 오류:', e);
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
    console.log('Babel 변환 오류:', e);
    return code;
  }
};

const TS_PATTERNS = [
  /interface\s+\w+/,
  /type\s+\w+\s*=/,
  /:\s*\w+(\[\])?(\s*\||\s*&|\s*=|\s*;|\s*,|\s*\))/,
  /as\s+\w+/,
  /<[A-Z]\w*>/,
  /enum\s+\w+/,
  /public\s+|private\s+|protected\s+/,
  /readonly\s+/,
  /\?\s*:/,
] as const;

export const detectTypeScript = (code: string): boolean => {
  return TS_PATTERNS.some(pattern => pattern.test(code));
};

const compileModule = (
  code: string,
  modules: Record<string, unknown>,
): Module => {
  const isTypeScript = detectTypeScript(code);
  const jsCode = isTypeScript ? compileTypeScript(code) : code;

  const render = new Function(
    'exports',
    'require',
    'module',
    'React',
    transformCode(jsCode),
  );

  const module: Module = { exports: {} };

  const customRequire = (name: string) => {
    if (name === 'react') {
      return React;
    }

    if (modules?.[name]) {
      return modules[name];
    }

    throw new Error(`Module not found: ${name}`);
  };

  render(module.exports, customRequire, module, React);

  return module;
};

const CONTAINER_REGEX =
  /(<main[^>]*id=["']app-container["'][^>]*>)([\s\S]*?)(<\/main>)/m;
const COMMENT_REGEX = /\{\s*\/\*[\s\S]*?\*\/\s*\}/g;
const SECTION_REGEX = /<section[\s\S]*?<\/section>/g;
const DATA_NAME_REGEX = /data-name=["']([^"']+)["']/;

export const extractSections = (code: string): Dnd.Section[] => {
  const cleanCode = code.replace(COMMENT_REGEX, '');
  const matches = [...cleanCode.matchAll(SECTION_REGEX)];

  return matches.map((m, i) => {
    const sectionCode = m[0];

    const dataNameMatch = sectionCode.match(DATA_NAME_REGEX);

    return {
      code: sectionCode,
      id: `${i}`,
      name: dataNameMatch?.[1] || `${i + 1}번째 컴포넌트`,
    };
  });
};

export const replaceSections = (code: string, sections: string[]): string => {
  const comments = [...code.matchAll(COMMENT_REGEX)].map(match => match[0]);

  const cleanCode = code.replace(SECTION_REGEX, '');
  const match = cleanCode.match(CONTAINER_REGEX);

  if (match) {
    const [, openTag, , closeTag] = match;
    const allContent = [...sections, ...comments].join('\n');

    return cleanCode.replace(
      CONTAINER_REGEX,
      `${openTag}\n${allContent}\n${closeTag}`,
    );
  }

  return code;
};

export const generateSection = (code: string, fullCode: string) => {
  const match = fullCode.match(CONTAINER_REGEX);

  if (!match) {
    return fullCode;
  }

  const [, openTag, , closeTag] = match;

  return fullCode.replace(CONTAINER_REGEX, `${openTag}\n${code}\n${closeTag}`);
};
