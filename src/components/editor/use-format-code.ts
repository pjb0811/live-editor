import { useCallback, useMemo } from 'react';

import { detectTypeScript } from '~/utils/detect-typescript';

// Prettier is an optional peer dependency (#282), loaded on first use.
// Without it, code comes back unformatted.
const loadPrettier = async () => {
  const [prettier, babel, estree, typescript] = await Promise.all([
    import('prettier'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
    import('prettier/plugins/typescript'),
  ]);

  return {
    format: prettier.format,
    plugins: [babel.default, estree.default, typescript.default],
  };
};

const DEFAULT_PRETTIER_OPTIONS: Record<string, unknown> = {
  tabWidth: 2,
  singleQuote: true,
  trailingComma: 'all',
  htmlWhitespaceSensitivity: 'ignore',
  arrowParens: 'avoid',
  printWidth: 60,
};

export interface UseFormatCodeOptions {
  fragment?: boolean;
  prettierOptions?: Record<string, unknown>;
}

// The formatter the built-in editor uses, shared with a custom
// `renderEditor`.
export const useFormatCode = ({
  fragment,
  prettierOptions,
}: UseFormatCodeOptions = {}) => {
  const prettierConfig = useMemo(
    () => ({
      ...DEFAULT_PRETTIER_OPTIONS,
      ...prettierOptions,
    }),
    [prettierOptions],
  );

  return useCallback(
    async (code: string) => {
      const typeScript = detectTypeScript(code);
      const source = fragment ? `<>${code}</>` : code;

      // Only a missing prettier is swallowed here; a genuine format error
      // (prettier present, but the code is unparseable) still propagates so
      // the editor's Cmd+S path can surface it via onError.
      let prettier: Awaited<ReturnType<typeof loadPrettier>>;
      try {
        prettier = await loadPrettier();
      } catch {
        return code;
      }

      const formatted = await prettier.format(source, {
        parser: typeScript ? 'typescript' : 'babel',
        plugins: prettier.plugins,
        ...prettierConfig,
      });

      if (fragment) {
        return formatted
          .replace(/^<>\n?/, '')
          .replace(/\n?<\/>;?\s*$/, '')
          .replace(/^ {2}/gm, '')
          .trim();
      }

      return formatted;
    },
    [prettierConfig, fragment],
  );
};
