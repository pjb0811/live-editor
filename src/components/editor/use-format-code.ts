import { useCallback, useMemo } from 'react';

import * as prettier from 'prettier';
import prettierPluginBabel from 'prettier/plugins/babel';
import prettierPluginEstree from 'prettier/plugins/estree';
import prettierPluginTypeScript from 'prettier/plugins/typescript';

import { detectTypeScript } from '~/utils';

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

// Extracted out of Core so a custom renderEditor (see editor.tsx's
// renderEditor prop) can reuse the exact same formatting behavior instead
// of reimplementing prettier wiring from scratch.
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
      const isTypeScript = detectTypeScript(code);
      const source = fragment ? `<>${code}</>` : code;
      const formatted = await prettier.format(source, {
        parser: isTypeScript ? 'typescript' : 'babel',
        plugins: [
          prettierPluginBabel,
          prettierPluginEstree,
          prettierPluginTypeScript,
        ],
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
