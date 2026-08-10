import { useCallback, useEffect } from 'react';

import { useDebouncedValue } from '@jbpark/use-hooks';

import { useError, usePreview } from '~/components/context/states';
import { DEFAULT_TEMPLATE } from '~/constants';

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

  const debouncedValue = useDebouncedValue(value, debounce);

  useEffect(() => {
    setCode(debouncedValue);
  }, [debouncedValue, setCode]);

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
