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

// Hosts usually pass `modules` inline (`modules={{ Chart }}`), a new object
// on every render. Compared by identity, that re-rendered and recompiled
// every section on every edit, and past the compilation cache's limit sent
// them back through Babel (#397). This keeps the previous object while the
// entries are the same, so everything keyed on it sees no change.
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
