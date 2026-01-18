import { useCallback, useMemo, useRef } from 'react';

import { javascript } from '@codemirror/lang-javascript';
import { useDebounce } from '@jbpark/use-hooks';
import { vscodeLight } from '@uiw/codemirror-theme-vscode';
import CodeMirror from '@uiw/react-codemirror';
import type { Extension, ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView } from 'codemirror';
import * as prettier from 'prettier';
import prettierPluginBabel from 'prettier/plugins/babel';
import prettierPluginEstree from 'prettier/plugins/estree';
import prettierPluginTypeScript from 'prettier/plugins/typescript';

import { useError, usePreview } from '~/components/Context/states';
import { DEFAULT_TEMPLATE } from '~/enums';
import { cn, detectTypeScript } from '~/utils';

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
  value: _value = DEFAULT_TEMPLATE,
  theme,
  height,
  debounce = 1000,
  className,
  prettierOptions,
  onChange: _onChange,
  ...props
}: Props) => {
  const { setCode } = usePreview();
  const { setError } = useError();

  const value = _value.trim() === '' ? DEFAULT_TEMPLATE : _value;
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const prettierConfig = useMemo(
    () => ({
      ...prettierInitialOptions,
      ...prettierOptions,
    }),
    [prettierOptions],
  );

  const formatCode = useCallback(
    async (code: string) => {
      const isTypeScript = detectTypeScript(code);
      return prettier.format(code, {
        parser: isTypeScript ? 'typescript' : 'babel',
        plugins: [
          prettierPluginBabel,
          prettierPluginEstree,
          prettierPluginTypeScript,
        ],
        ...prettierConfig,
      });
    },
    [prettierConfig],
  );

  const onChange = useCallback(
    (value: string) => {
      _onChange?.(value);
    },
    [_onChange],
  );

  const onSave = useCallback(
    async (value: string) => {
      try {
        const currentView = editorRef.current?.view;
        if (!currentView) {
          return;
        }

        const currentLength = currentView.state.doc.length;
        const formattedCode = await formatCode(value);

        if (currentLength === currentView.state.doc.length) {
          const transaction = currentView.state.update({
            changes: { from: 0, to: currentLength, insert: formattedCode },
          });
          currentView.dispatch(transaction);

          _onChange?.(formattedCode);
          setCode(formattedCode);
        }

        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [formatCode, _onChange, setCode, setError],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave(value);
      }
    },
    [onSave, value],
  );

  useDebounce(
    () => {
      setCode(value);
    },
    { delay: debounce },
    [value],
  );

  return (
    <div className={cn(className)} onKeyDown={onKeyDown}>
      <CodeMirror
        ref={editorRef}
        theme={theme || vscodeLight}
        height={height || '100%'}
        value={value}
        extensions={[
          javascript({ jsx: true, typescript: true }),
          EditorView.lineWrapping,
        ]}
        onChange={onChange}
        {...props}
      />
    </div>
  );
};

export default Editor;
