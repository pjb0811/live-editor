import { REGEX, TS_PATTERNS } from '../constants';

export const detectTypeScript = (code: string): boolean => {
  // Drop `import` and `export ... from` lines first: their `as`
  // (`import * as ui`) is plain JavaScript but matches the `as\s+\w+` check
  // below.
  const withoutModuleLines = code.replace(REGEX.MODULE_IMPORT_EXPORT_LINE, '');

  return TS_PATTERNS.some(pattern => pattern.test(withoutModuleLines));
};
