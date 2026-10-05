import React from 'react';

import {
  type LiveMessages,
  MessagesContext,
} from '~/components/context/messages';

import Error from './error';

interface Props {
  children: React.ReactNode;
  // `reset` clears the caught error and renders `children` again, the same
  // thing the built-in error's reset button does.
  fallback?: (message?: string, reset?: () => void) => React.ReactNode;
  onError?: (e: Error, info: React.ErrorInfo) => void;
  // When any of these values changes (compared one by one, by identity), a
  // caught error resets and `children` render again, such as when the code
  // that failed is edited.
  resetKeys?: readonly unknown[];
}

interface State {
  hasError: boolean;
  error?: Error;
  // The resetKeys the last render saw, so getDerivedStateFromProps can tell
  // when they change.
  resetKeys?: readonly unknown[];
}

const keysChanged = (
  prev: readonly unknown[] = [],
  next: readonly unknown[] = [],
) => prev.length !== next.length || next.some((key, i) => key !== prev[i]);

class ErrorBoundary extends React.Component<Props, State> {
  static contextType = MessagesContext;
  declare context: LiveMessages;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, resetKeys: props.resetKeys };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 [Boundary] Rendering error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  // Clears a caught error in the same render that sees new resetKeys, so
  // `children` get their next chance right away and the fallback doesn't
  // render (and run its effects) once more first (#442). If `children` throw
  // again with the new keys, getDerivedStateFromError catches that in this
  // same render pass.
  static getDerivedStateFromProps(
    props: Props,
    state: State,
  ): Partial<State> | null {
    if (!keysChanged(state.resetKeys, props.resetKeys)) {
      return null;
    }

    return state.hasError
      ? { hasError: false, error: undefined, resetKeys: props.resetKeys }
      : { resetKeys: props.resetKeys };
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      return this.props.fallback ? (
        <>{this.props.fallback(this.state.error?.message, this.reset)}</>
      ) : (
        <Error
          message={this.state.error?.message}
          onReset={this.reset}
          title={this.context.errors.rendering}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
