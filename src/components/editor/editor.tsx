import { useCallback, useEffect } from 'react';

import { useDebouncedValue } from '@jbpark/use-hooks';

import { useError, usePreview } from '~/components/context/states';
import { DEFAULT_TEMPLATE } from '~/constants';

import Core, { type Props as CoreProps } from './core';
import { useFormatCode } from './use-format-code';

export interface EditorRenderData {
  value: string;
  onChange: (value: string) => void;
  // Same prettier-based formatting Core's own Cmd+S uses - reused rather
  // than reimplemented, so a custom editor can offer equivalent
  // format-on-save behavior without duplicating the prettier wiring.
  formatCode: (code: string) => Promise<string>;
}

export interface Props extends Omit<CoreProps, 'onSave' | 'onError'> {
  defaultValue?: string;
  debounce?: number;
  // Full replacement for the built-in CodeMirror editor. Editor still owns
  // syncing `value` to the shared preview code (debounced), regardless of
  // which UI renders it - only the editing surface itself is customizable.
  renderEditor?: (data: EditorRenderData) => React.ReactNode;
}

const Editor = ({
  defaultValue,
  value: _value,
  debounce = 1000,
  onChange: _onChange,
  renderEditor,
  fragment,
  prettierOptions,
  ...props
}: Props) => {
  const { setCode } = usePreview();
  const { setError } = useError();

  const value =
    _value.trim() === '' ? defaultValue || DEFAULT_TEMPLATE : _value;

  const onChange = useCallback(
    (value: string) => {
      _onChange?.(value);
    },
    [_onChange],
  );

  const onSave = useCallback(
    (formattedCode: string) => {
      setCode(formattedCode);
    },
    [setCode],
  );

  const onError = useCallback(
    (error: string | null) => {
      setError(error);
    },
    [setError],
  );

  const formatCode = useFormatCode({ fragment, prettierOptions });

  const debouncedValue = useDebouncedValue(value, debounce);

  useEffect(() => {
    setCode(debouncedValue);
  }, [debouncedValue, setCode]);

  if (renderEditor) {
    return renderEditor({ value, onChange, formatCode });
  }

  return (
    <Core
      value={value}
      onChange={onChange}
      onSave={onSave}
      onError={onError}
      fragment={fragment}
      prettierOptions={prettierOptions}
      {...props}
    />
  );
};

export default Editor;
