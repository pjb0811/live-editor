import { cn } from '~/utils';

import ErrorBoundary from './Boundary';
import ErrorGuard from './Guard';
import ErrorRuntime from './Runtime';

export interface Props extends React.HTMLAttributes<HTMLDivElement> {
  message?: string | null;
  title?: string;
  onReset?: () => void;
}

const Error = ({
  message,
  title = '오류가 발생했습니다',
  className,
  onReset,
}: Props) => {
  if (!message) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded border border-red-200 bg-red-50 p-4 text-red-700',
        className,
      )}
    >
      <h3 className="text-sm font-bold">{title}</h3>
      <pre className="mt-2 text-xs whitespace-pre-wrap">{message}</pre>
      {onReset && (
        <button
          className="mt-2 rounded bg-red-100 px-3 py-1 text-xs hover:bg-red-200"
          onClick={onReset}
        >
          다시 시도
        </button>
      )}
    </div>
  );
};

Error.Boundary = ErrorBoundary;
Error.Runtime = ErrorRuntime;
Error.Guard = ErrorGuard;

export { ErrorBoundary, ErrorRuntime, ErrorGuard };

export default Error;
