'use client';

import { useElementSize } from 'use-hooks';

import { cn } from '~/utils';

export type BreakpointInfo = ReturnType<typeof useElementSize>['breakpoint'];

interface Props {
  className?: string;
  children: (breakpoint: BreakpointInfo) => React.ReactNode;
}

const Breakpointer = ({ className, children }: Props) => {
  const { breakpoint, elementRef } = useElementSize<HTMLDivElement>();

  return (
    <div
      ref={elementRef}
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
