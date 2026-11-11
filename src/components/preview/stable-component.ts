import { Component as ReactComponent, createElement } from 'react';

type Props = Record<string, unknown>;
type Component = React.ComponentType<Props>;

// Every hook call in `code`, in source order: `useState(`, `React.useMemo(`,
// `use(`. Two compiles of a component with the same list call the same
// hooks in the same order, which is what React needs to keep its state.
const HOOK_CALL = /\buse(?:[A-Z0-9_]\w*)?\s*\(/g;

export const hookSignature = (code: string): string =>
  (code.match(HOOK_CALL) ?? [])
    .map(call => call.replace(/\s*\($/, ''))
    .join(',');

// A plain function component, which can be called with its props. Class
// components and the objects `memo`, `forwardRef` and `lazy` return can't.
const isFunctionComponent = (
  component: Component,
): component is React.FunctionComponent<Props> =>
  typeof component === 'function' &&
  !(component.prototype as { isReactComponent?: unknown } | undefined)
    ?.isReactComponent;

interface StableProps {
  render: React.FunctionComponent<Props>;
  props: Props;
}

// One component type for every compile, which calls the compiled function
// itself, so the function's output belongs to this type.
const StableComponent = ({ render, props }: StableProps) => render(props);

interface RemountState {
  error: unknown;
  // Bumped to remount `StableComponent` with fresh state.
  attempt: number;
}

// Remounts `StableComponent` once when a new compile throws on its first
// render, then lets the error through. `hookSignature` reads hook calls from
// the whole document, so moving a hook from one component to another keeps
// the signature while the root component's hook count changes, and React
// throws (#724). A remount is all it needs. An error from a compile that has
// rendered before isn't retried: a remount would hide it and reset the state
// that caused it.
class RemountOnRecompileError extends ReactComponent<
  StableProps,
  RemountState
> {
  state: RemountState = { error: null, attempt: 0 };

  // The last compile that rendered without an error.
  private committedRender: StableProps['render'] | null = null;
  // The compile already retried, so a second error from it goes through.
  private retriedRender: StableProps['render'] | null = null;

  static getDerivedStateFromError(error: unknown): Partial<RemountState> {
    return { error };
  }

  private canRetry() {
    const { render } = this.props;

    return (
      this.committedRender !== null &&
      this.committedRender !== render &&
      this.retriedRender !== render
    );
  }

  componentDidCatch() {
    if (this.canRetry()) {
      this.retriedRender = this.props.render;
      this.setState(({ attempt }) => ({ error: null, attempt: attempt + 1 }));
    }
  }

  componentDidMount() {
    this.committedRender = this.props.render;
  }

  componentDidUpdate() {
    if (this.state.error === null) {
      this.committedRender = this.props.render;
    }
  }

  render() {
    const { error, attempt } = this.state;

    if (error !== null) {
      // Thrown from here, the error reaches the boundary outside, which
      // shows it as before.
      if (!this.canRetry()) {
        throw error;
      }

      return null;
    }

    return createElement(StableComponent, { ...this.props, key: attempt });
  }
}

// Renders `Component`, compiled from `code`, under a component type that
// survives a recompile. Each compile returns a new function, and React
// remounts a subtree whose component type changes, so rendering it directly
// rebuilds a section's whole DOM on every edit. While the hook calls in
// `code` stay the same, the type and key here stay the same too, and React
// updates only what the new output changes. When they change, the key
// changes and the subtree remounts, so React never sees a different hook
// order. A class, `memo` or `forwardRef` component renders as itself.
export const renderStableComponent = (
  Component: Component,
  code: string,
  props: Props,
): React.ReactElement =>
  isFunctionComponent(Component)
    ? createElement(RemountOnRecompileError, {
        key: hookSignature(code),
        render: Component,
        props,
      })
    : createElement(Component, props);
