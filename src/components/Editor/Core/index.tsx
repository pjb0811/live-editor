import { useCallback, useMemo, useRef } from 'react';

import { javascript } from '@codemirror/lang-javascript';
import { vscodeLight } from '@uiw/codemirror-theme-vscode';
import CodeMirror, {
  type Extension,
  type ReactCodeMirrorRef,
} from '@uiw/react-codemirror';
import { EditorView } from 'codemirror';
import * as prettier from 'prettier';
import prettierPluginBabel from 'prettier/plugins/babel';
import prettierPluginEstree from 'prettier/plugins/estree';
import prettierPluginTypeScript from 'prettier/plugins/typescript';

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
  value: string;
  height?: string;
  theme?: Extension | 'light' | 'dark' | 'none';
  prettierOptions?: Record<string, unknown>;
  fragment?: boolean;
  className?: string;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  onError?: (error: string | null) => void;
}

const Core = ({
  value,
  theme,
  height,
  className,
  prettierOptions,
  fragment,
  onChange,
  onSave: _onSave,
  onError,
  ...props
}: Props) => {
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

  const onSave = useCallback(
    async (val: string) => {
      try {
        const currentView = editorRef.current?.view;
        if (!currentView) {
          return;
        }

        const currentLength = currentView.state.doc.length;
        const cursorPos = currentView.state.selection.main.head;
        const formattedCode = await formatCode(val);

        if (currentLength === currentView.state.doc.length) {
          const newCursorPos = Math.min(cursorPos, formattedCode.length);
          const transaction = currentView.state.update({
            changes: { from: 0, to: currentLength, insert: formattedCode },
            selection: { anchor: newCursorPos },
          });
          currentView.dispatch(transaction);

          onChange?.(formattedCode);
          _onSave?.(formattedCode);
        }

        onError?.(null);
      } catch (e) {
        onError?.(e instanceof Error ? e.message : String(e));
      }
    },
    [formatCode, onChange, _onSave, onError],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        const currentValue =
          editorRef.current?.view?.state.doc.toString() || value;
        onSave(currentValue);
      }
    },
    [onSave, value],
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

export default Core;
