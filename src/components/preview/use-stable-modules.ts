import { useState } from 'react';

type Modules = Record<string, unknown> | undefined;

// Same keys, each value the same object. A module is compared by identity,
// never deeply: a module replaced with a changed object has to recompile
// (#329). This is also how the compilation cache tells modules apart.
const sameModules = (a: Modules, b: Modules): boolean => {
  if (a === b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  const keys = Object.keys(a);

  return (
    keys.length === Object.keys(b).length &&
    keys.every(key => Object.hasOwn(b, key) && Object.is(a[key], b[key]))
  );
};

// Keeps the previous `modules` object while its entries are the same, since
// hosts usually pass a new inline object every render, which would recompile
// every section (#397).
export const useStableModules = <T extends Modules>(modules: T): T => {
  const [stable, setStable] = useState(modules);

  if (sameModules(stable, modules)) {
    return stable;
  }

  // Adjusted during render, so the changed modules are used in this render
  // rather than one render late.
  setStable(modules);

  return modules;
};
