import { useCallback } from 'react';

import { useDebounce } from '@jbpark/use-hooks';

import { useError, usePreview } from '~/components/context/states';
import { DEFAULT_TEMPLATE } from '~/enums';

import Core, { type Props as CoreProps } from './core';

export interface Props extends Omit<CoreProps, 'onSave' | 'onError'> {
  defaultValue?: string;
  debounce?: number;
}

const Editor = ({
  defaultValue,
  value: _value,
  debounce = 1000,
  onChange: _onChange,
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

  useDebounce(
    () => {
      setCode(value);
    },
    { delay: debounce },
    [value],
  );

  return (
    <Core
      value={value}
      onChange={onChange}
      onSave={onSave}
      onError={onError}
      {...props}
    />
  );
};

export default Editor;
