import { useEffect } from 'react';

import { useEventListener } from '@jbpark/use-hooks';

import { useLiveMessages } from '~/components/context/messages';
import { useError } from '~/components/context/states';

import Error from './error';

// Exported although no file imports it: the declaration of `App` in
// `src/index.tsx` names it, and TypeScript can't name a type from another
// module unless it is exported (TS4023).
export interface Props extends React.ComponentPropsWithRef<'div'> {
  open?: boolean;
  reset?: () => void;
}

const Runtime = ({ open = true, reset }: Props) => {
  const { error: message, setError } = useError();
  const messages = useLiveMessages();

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

  return (
    <Error message={message} onReset={reset} title={messages.errors.runtime} />
  );
};

export default Runtime;
