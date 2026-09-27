import { REGEX, TS_PATTERNS } from '../constants';

export const detectTypeScript = (code: string): boolean => {
  // Strip `import`/`export ... from '...'` lines first — aliasing via `as`
  // (`import * as ui from 'ui-kit'`, `import { Foo as Bar } from '...'`) is
  // plain ES module syntax, not a TypeScript signal, but it otherwise
  // matches the `as\s+\w+` pattern below and made every piece of code look
  // like TypeScript.
  const withoutModuleLines = code.replace(REGEX.MODULE_IMPORT_EXPORT_LINE, '');

  return TS_PATTERNS.some(pattern => pattern.test(withoutModuleLines));
};
