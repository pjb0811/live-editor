import ErrorBoundary from './boundary';
import ErrorImpl, { type Props } from './error';
import ErrorGuard from './guard';
import ErrorRuntime from './runtime';

type ErrorComponent = typeof ErrorImpl & {
  Boundary: typeof ErrorBoundary;
  Runtime: typeof ErrorRuntime;
  Guard: typeof ErrorGuard;
};

const Error = ErrorImpl as ErrorComponent;

Error.Boundary = ErrorBoundary;
Error.Runtime = ErrorRuntime;
Error.Guard = ErrorGuard;

export { ErrorBoundary, ErrorRuntime, ErrorGuard };
export type { Props };
export default Error;
