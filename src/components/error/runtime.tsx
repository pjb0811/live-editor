import { useEffect } from 'react';

import { useEventListener } from '@jbpark/use-hooks';

import { useError } from '~/components/context/states';

import Error from './error';

export interface Props extends React.ComponentPropsWithRef<'div'> {
  open?: boolean;
  reset?: () => void;
}

const Runtime = ({ open = true, reset }: Props) => {
  const { error: message, setError } = useError();

  useEventListener('error', e => {
    setError(e.message);
    e.preventDefault();
  });

  useEffect(() => {
    return () => setError(null);
  }, [setError]);

  if (!open) {
    return null;
  }

  return <Error message={message} onReset={reset} title="Runtime Error" />;
};

export default Runtime;
