import { createElement } from 'react';

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
    ? createElement(StableComponent, {
        key: hookSignature(code),
        render: Component,
        props,
      })
    : createElement(Component, props);
