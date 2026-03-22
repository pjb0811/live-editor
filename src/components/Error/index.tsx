import { cn } from '~/utils';

import ErrorBoundary from './Boundary';
import ErrorGuard from './Guard';
import ErrorRuntime from './Runtime';

export interface Props extends React.ComponentPropsWithRef<'div'> {
  message?: string | null;
  title?: string;
  onReset?: () => void;
}

const Error = ({
  message,
  title = 'An error occurred',
  className,
  onReset,
}: Props) => {
  if (!message) {
    return null;
  }

  return (
    <div
      className={cn(className)}
      style={{
        padding: '16px',
        backgroundColor: '#fee2e2',
        border: '1px solid #fca5a5',
        borderRadius: '6px',
        color: '#7f1d1d',
      }}
    >
      <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>
        {title}
      </h3>
      <pre
        style={{
          marginTop: '8px',
          fontSize: '12px',
          whiteSpace: 'pre-wrap',
          margin: '8px 0 0 0',
        }}
      >
        {message}
      </pre>
      {onReset && (
        <button
          style={{
            marginTop: '8px',
            padding: '4px 12px',
            fontSize: '12px',
            color: 'white',
            backgroundColor: '#dc2626',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          onClick={onReset}
        >
          Try Again
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
