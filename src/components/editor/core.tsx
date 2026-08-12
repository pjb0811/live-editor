import { useCallback, useRef } from 'react';

import { javascript } from '@codemirror/lang-javascript';
import { vscodeLight } from '@uiw/codemirror-theme-vscode';
import CodeMirror, {
  type Extension,
  type ReactCodeMirrorRef,
} from '@uiw/react-codemirror';
import { EditorView } from 'codemirror';

import { cn } from '~/utils';

import { useFormatCode } from './use-format-code';

export interface Props {
  value: string;
  height?: string;
  theme?: Extension | 'light' | 'dark' | 'none';
  prettierOptions?: Record<string, unknown>;
  fragment?: boolean;
  raw?: boolean;
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
  raw,
  onChange,
  onSave: _onSave,
  onError,
  ...props
}: Props) => {
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const formatCode = useFormatCode({ fragment, prettierOptions });

  const onSave = useCallback(
    async (val: string) => {
      try {
        const currentView = editorRef.current?.view;
        if (!currentView) {
          return;
        }

        const currentLength = currentView.state.doc.length;
        const cursorPos = currentView.state.selection.main.head;
        const formattedCode = raw ? val : await formatCode(val);

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
    [raw, formatCode, onChange, _onSave, onError],
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
