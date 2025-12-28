'use client';

import { useElementSize } from '@jax/use-hooks';

import { cn } from '~/utils';

export type BreakpointInfo = ReturnType<typeof useElementSize>['breakpoint'];

interface Props {
  className?: string;
  children: (breakpoint: BreakpointInfo) => React.ReactNode;
}

const Breakpointer = ({ className, children }: Props) => {
  const { breakpoint, ref } = useElementSize<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        'h-full w-full',
        className,
        //
      )}
    >
      {children(breakpoint)}
    </div>
  );
};

export default Breakpointer;
