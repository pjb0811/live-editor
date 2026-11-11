import { useEffect } from 'react';

import { useEventListener } from '@jbpark/use-hooks';

import { useLiveMessages } from '~/components/context/messages';
import { useError } from '~/components/context/states';

import Error from './error';
import { isIgnoredPageError } from './ignored-page-error';

// Exported although no file imports it: the declaration of `App` in
// `src/index.tsx` names it, and TypeScript can't name a type from another
// module unless it is exported (TS4023).
export interface Props extends Omit<
  React.ComponentPropsWithRef<'div'>,
  // The component renders its own content.
  'children' | 'dangerouslySetInnerHTML'
> {
  open?: boolean;
  reset?: () => void;
}

const Runtime = ({ open = true, reset, ...divProps }: Props) => {
  const { error: message, setError } = useError();
  const messages = useLiveMessages();

  // Not `preventDefault()`, so the browser still reports the error (#714).
  useEventListener('error', e => {
    if (isIgnoredPageError(e.message)) {
      return;
    }

    setError(e.message);
  });

  useEffect(() => {
    return () => setError(null);
  }, [setError]);

  if (!open) {
    return null;
  }

  return (
    <Error
      {...divProps}
      message={message}
      onReset={reset}
      title={messages.errors.runtime}
    />
  );
};

export default Runtime;
