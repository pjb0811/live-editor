import CodeEditor from '@jbpark/ui-kit/CodeEditor';
import { vscodeLight } from '@uiw/codemirror-theme-vscode';
import { type Extension } from '@uiw/react-codemirror';

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

// The CodeMirror surface, the Cmd+S save transaction and the JS/TS + line-wrap
// extensions now live in `@jbpark/ui-kit`'s CodeEditor (#346/#309). This stays
// only to keep live-editor's own vocabulary: `raw`/`fragment`/`prettierOptions`
// shape the injected prettier formatter, and `onError` maps to the component's
// `onFormatError`.
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

  return (
    <CodeEditor
      value={value}
      theme={theme ?? vscodeLight}
      height={height || '100%'}
      className={cn(className)}
      // `raw` (e.g. innerHTML) skips prettier; otherwise reuse the shared
      // prettier wiring as the Cmd+S formatter rather than reimplementing it.
      formatCode={raw ? undefined : formatCode}
      onChange={onChange}
      onSave={onSave}
      onFormatError={onError}
      {...props}
    />
  );
};

export default Core;
