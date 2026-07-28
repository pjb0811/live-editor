import React from 'react';

import Error from './error';

interface Props {
  children: React.ReactNode;
  fallback?: (message?: string) => React.ReactNode;
  onError?: (e: Error, info: React.ErrorInfo) => void;
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
