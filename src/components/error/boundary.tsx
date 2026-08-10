import React from 'react';

import Error from './error';

interface Props {
  children: React.ReactNode;
  fallback?: (message?: string) => React.ReactNode;
  onError?: (e: Error, info: React.ErrorInfo) => void;
  // Values whose identity changing (typically the code/module that produced
  // `children`) should auto-recover a caught error without needing a
  // remount — compared shallowly, one entry at a time, same idea as
  // react-error-boundary's resetKeys. Without this, once tripped, render()
  // never even attempts `children` again (see below), so a fix to the
  // underlying code has no way to reach the screen until this array changes
  // or something remounts the boundary via `key`.
  resetKeys?: readonly unknown[];
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 [Boundary] Rendering error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  // Safe to reset unconditionally here (no race with a freshly-thrown
  // error): while hasError is true, render() below never attempts
  // `children` at all, so resetting just schedules a follow-up render where
  // `children` gets its first real chance to run with the new resetKeys —
  // if that throws too, getDerivedStateFromError catches it fresh in that
  // later, separate commit.
  componentDidUpdate(prevProps: Props) {
    if (!this.state.hasError) {
      return;
    }

    const prevKeys = prevProps.resetKeys ?? [];
    const nextKeys = this.props.resetKeys ?? [];
    const changed =
      prevKeys.length !== nextKeys.length ||
      nextKeys.some((key, i) => key !== prevKeys[i]);

    if (changed) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ? (
        <>{this.props.fallback(this.state.error?.message)}</>
      ) : (
        <Error
          message={this.state.error?.message}
          onReset={() => this.setState({ hasError: false, error: undefined })}
          title="Rendering Error"
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
