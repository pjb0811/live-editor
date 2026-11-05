import { useRef } from 'react';

import { javascript } from '@codemirror/lang-javascript';
import { vscodeLight } from '@uiw/codemirror-theme-vscode';
import CodeMirror, {
  EditorView,
  type Extension,
  type ReactCodeMirrorProps,
  type ReactCodeMirrorRef,
} from '@uiw/react-codemirror';

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
  onCreateEditor?: ReactCodeMirrorProps['onCreateEditor'];
  onUpdate?: ReactCodeMirrorProps['onUpdate'];
}

// JSX and TypeScript highlighting, with long lines wrapped.
const EXTENSIONS = [
  javascript({ jsx: true, typescript: true }),
  EditorView.lineWrapping,
];

// CodeMirror with this library's options (#346, #309). Cmd/Ctrl+S formats
// the code with Prettier, shaped by `raw`, `fragment` and
// `prettierOptions`, then calls `onChange` and `onSave`; a formatter error
// goes to `onError`.
const Core = ({
  value,
  theme,
  height,
  className,
  prettierOptions,
  fragment,
  raw,
  onChange,
  onSave,
  onError,
  ...props
}: Props) => {
  const formatCode = useFormatCode({ fragment, prettierOptions });

  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const save = async () => {
    const view = editorRef.current?.view;

    if (!view) {
      return;
    }

    const current = view.state.doc.toString();

    try {
      // `raw` (e.g. innerHTML) skips Prettier.
      const next = raw ? current : await formatCode(current);

      // An edit landed while Prettier ran: keep it rather than the result.
      if (view.state.doc.toString() !== current) {
        onError?.(null);

        return;
      }

      if (next !== current) {
        view.dispatch({
          changes: { from: 0, to: current.length, insert: next },
          selection: {
            anchor: Math.min(view.state.selection.main.head, next.length),
          },
        });
      }

      onChange?.(next);
      onSave?.(next);
      onError?.(null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div
      className={className}
      onKeyDown={e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
          e.preventDefault();
          void save();
        }
      }}
    >
      <CodeMirror
        ref={editorRef}
        value={value}
        theme={theme ?? vscodeLight}
        height={height || '100%'}
        extensions={EXTENSIONS}
        onChange={onChange}
        {...props}
      />
    </div>
  );
};

export default Core;
