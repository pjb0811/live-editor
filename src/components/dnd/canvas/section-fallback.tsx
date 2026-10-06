import { useContext } from 'react';

import ErrorBoundary from '~/components/error/boundary';

import {
  type DndRenderSectionFallback,
  type DndSectionFallbackArgs,
  SectionFallbackContext,
} from './section-fallback-context';

interface ConsumerFallbackProps {
  render: DndRenderSectionFallback;
  args: DndSectionFallbackArgs;
  builtin: React.ReactElement;
}

// Its own component so the consumer's function runs inside the guard below:
// a throw from the call itself, not only from what it returns, is caught.
const ConsumerFallback = ({ render, args, builtin }: ConsumerFallbackProps) => {
  const node = render(args);

  return node === undefined ? builtin : <>{node}</>;
};

interface Props {
  args: DndSectionFallbackArgs;
  // What renders when no consumer fallback is set, when it returns
  // `undefined`, or when it throws.
  builtin: React.ReactElement;
}

const SectionFallback = ({ args, builtin }: Props) => {
  const render = useContext(SectionFallbackContext);

  if (!render) {
    return builtin;
  }

  // A broken fallback must not break the canvas: revert to the built-in
  // error for this section only.
  return (
    <ErrorBoundary fallback={() => builtin}>
      <ConsumerFallback render={render} args={args} builtin={builtin} />
    </ErrorBoundary>
  );
};

export default SectionFallback;
