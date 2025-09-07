import { useEffect } from 'react';

import { useError } from '~/components/Context/states';

import Error from '..';

export interface Props extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  reset?: () => void;
}

const Runtime = ({ open = true, reset }: Props) => {
  const { error, setError } = useError();

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

  return <Error error={error} onReset={reset} title="실행 오류" />;
};

export default Runtime;
