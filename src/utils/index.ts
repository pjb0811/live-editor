import React from 'react';

import * as Babel from '@babel/standalone';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as ts from 'typescript';

interface Module {
  exports: {
    default?: React.ComponentType<Record<string, unknown>>;
  };
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const compileTypeScript = (code: string): string => {
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React,
    strict: false,
    esModuleInterop: true,
    skipLibCheck: true,
    declaration: false,
  };

  const result = ts.transpileModule(code, {
    compilerOptions,
  });

  return result.outputText;
};

export const transformCode = (code: string): string => {
  const result = Babel.transform(code, {
    presets: ['env', 'react'],
    sourceType: 'module',
    plugins: [
      [Babel.availablePlugins['transform-modules-commonjs']],
      //
    ],
  }).code;
  return result || '';
};

export const detectTypeScript = (code: string): boolean => {
  const tsPatterns = [
    /interface\s+\w+/,
    /type\s+\w+\s*=/,
    /:\s*\w+(\[\])?(\s*\||\s*&|\s*=|\s*;|\s*,|\s*\))/,
    /as\s+\w+/,
    /<[A-Z]\w*>/,
    /enum\s+\w+/,
    /public\s+|private\s+|protected\s+/,
    /readonly\s+/,
    /\?\s*:/,
  ];

  return tsPatterns.some(pattern => pattern.test(code));
};

export const compileModule = (
  code: string,
  imports: Record<string, unknown>,
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

    if (imports?.[name]) {
      return imports[name];
    }

    throw new Error(`Module not found: ${name}`);
  };

  render(module.exports, customRequire, module, React);

  return module;
};

export const extractSections = (code: string): Dnd.Section[] => {
  const matches = [...code.matchAll(/<section[\s\S]*?<\/section>/g)];
  return matches.map((m, i) => {
    const sectionCode = m[0];

    // data-name 속성 추출
    const dataNameMatch = sectionCode.match(/data-name=["']([^"']+)["']/);
    const name = dataNameMatch?.[1]
      ? dataNameMatch[1]
      : `${i + 1}번째 컴포넌트`;

    return {
      code: sectionCode,
      id: `${i}`,
      name: name,
    };
  });
};

export const replaceSections = (code: string, sections: string[]): string => {
  // 모든 section 태그를 제거
  const cleanCode = code.replace(/<section[\s\S]*?<\/section>/g, '');

  // app-container div 찾기
  const containerRegex =
    /(<div[^>]*id=["']app-container["'][^>]*>)([\s\S]*?)(<\/div>)/;
  const match = cleanCode.match(containerRegex);

  if (match) {
    const [, openTag, , closeTag] = match;
    // 섹션들을 적절한 들여쓰기와 함께 배치
    const sectionsCode = sections.map(section => `      ${section}`).join('\n');

    return cleanCode.replace(
      containerRegex,
      `${openTag}\n${sectionsCode}\n    ${closeTag}`,
    );
  }

  // app-container가 없으면 기존 방식 사용
  const sectionsCode = sections.join('\n');
  return `${cleanCode}\n${sectionsCode}`;
};
