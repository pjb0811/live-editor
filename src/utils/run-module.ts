import React from 'react';

import type { Module } from '~/types';

// Runs a module that `transpile()` produced, against `react` and `modules`,
// and returns its exports. It needs no Babel, so a page that only shows saved
// documents can run code transpiled ahead of time, on a server or at save
// time, without shipping a compiler (#771). `compile()` is `transpile()`
// followed by this.
//
// The code runs in this window's own JS realm, with the page's privileges,
// as everything `compile()` runs does. See the README's "Security Notes".
export const runModule = (
  js: string,
  modules: Record<string, unknown> = {},
): Module => {
  type RenderFunction = (
    exports: Module['exports'],
    require: (name: string) => unknown,
    module: Module,
    React: typeof import('react'),
  ) => void;

  let render: RenderFunction;

  try {
    render = new Function(
      'exports',
      'require',
      'module',
      'React',
      js,
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
