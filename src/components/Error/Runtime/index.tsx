import { useEffect } from 'react';

import { useError } from '~/components/Context/states';

import Error from '..';

export interface Props extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  reset?: () => void;
}

const Runtime = ({ open = true, reset }: Props) => {
  const { error: message, setError } = useError();

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      setError(e.message);
      e.preventDefault();
    };

    window.addEventListener('error', onError);

    return () => {
      setError(null);
      window.removeEventListener('error', onError);
    };
  }, [setError]);

  if (!open) {
    return null;
  }

  return <Error message={message} onReset={reset} title="Runtime Error" />;
};

export default Runtime;
