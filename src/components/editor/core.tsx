import type { ComponentProps } from 'react';

import CodeEditor from '@jbpark/ui-kit/CodeEditor';
import { vscodeLight } from '@uiw/codemirror-theme-vscode';
import { type Extension } from '@uiw/react-codemirror';

import { cn } from '~/utils/cn';

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
  onCreateEditor?: ComponentProps<typeof CodeEditor>['onCreateEditor'];
  onUpdate?: ComponentProps<typeof CodeEditor>['onUpdate'];
}

// `@jbpark/ui-kit`'s CodeEditor with this library's options (#346, #309):
// `raw`, `fragment` and `prettierOptions` shape the Prettier formatter, and
// `onError` is its `onFormatError`.
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
