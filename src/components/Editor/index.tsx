import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import { javascript } from '@codemirror/lang-javascript';
import { vscodeLight } from '@uiw/codemirror-theme-vscode';
import CodeMirror from '@uiw/react-codemirror';
import type { Extension } from '@uiw/react-codemirror';
import { EditorView } from 'codemirror';
import * as prettier from 'prettier';
import prettierPluginBabel from 'prettier/plugins/babel';
import prettierPluginEstree from 'prettier/plugins/estree';
import prettierPluginTypeScript from 'prettier/plugins/typescript';

import { useError, usePreview } from '~/components/Context/states';
import { DEFAULT_TEMPLATE } from '~/enums';
import { cn } from '~/utils';
import { detectTypeScript } from '~/utils';

const prettierInitialOptions: Record<string, unknown> = {
  tabWidth: 2,
  singleQuote: true,
  trailingComma: 'all',
  htmlWhitespaceSensitivity: 'ignore',
  arrowParens: 'avoid',
  printWidth: 60,
};

export interface Props {
  value?: string;
  height?: string;
  theme?: Extension | 'light' | 'dark' | 'none';
  prettierOptions?: Record<string, unknown>;
  debounce?: number;
  className?: string;
  onChange?: (value: string) => void;
}

const Editor = ({
  value: _value = '',
  theme,
  height,
  debounce = 1000,
  className,
  prettierOptions,
  onChange: _onChange,
  ...props
}: Props) => {
  const [value, setValue] = useState('');
  const { setCode } = usePreview();
  const { setError } = useError();

  const onChange = async (value: string, format?: boolean) => {
    try {
      const isTypeScript = detectTypeScript(value);

      const formattedCode = await prettier.format(value, {
        parser: isTypeScript ? 'typescript' : 'babel',
        plugins: [
          prettierPluginBabel,
          prettierPluginEstree,
          prettierPluginTypeScript,
        ],
        ...prettierInitialOptions,
        ...prettierOptions,
      });

      _onChange?.(format ? formattedCode : value);
      setCode(format ? formattedCode : value);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      onChange(value, true);
    }
  };

  useEffect(() => {
    setValue(_value || DEFAULT_TEMPLATE);
  }, [_value]);

  useDebounce(
    () => {
      onChange(value);
    },
    debounce,
    [value],
  );

  return (
    <div
      className={cn(
        'h-full',
        className,
        //
      )}
      onKeyDown={onKeyDown}
    >
      <CodeMirror
        theme={theme || vscodeLight}
        height={height || '100%'}
        extensions={[
          javascript({ jsx: true, typescript: true }),
          EditorView.lineWrapping,
        ]}
        value={value}
        onChange={setValue}
        {...props}
      />
    </div>
  );
};

export default Editor;
