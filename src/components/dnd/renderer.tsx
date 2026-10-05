import { memo } from 'react';

import { useLiveMessages } from '~/components/context/messages';
import ErrorBoundary from '~/components/error/boundary';
import LiveError from '~/components/error/error';
import Frame, { type FrameProps } from '~/components/frame';
import { useCompiledModule } from '~/components/preview/use-compiled-module';
import { useDynamicTailwind } from '~/components/preview/use-dynamic-tailwind';

import SectionFallback from './section-fallback';

interface Props {
  preview: string;
  // The section for `renderSectionFallback`, as strings: a `Section` object
  // is new on every document change and would break the memo below.
  sectionId?: string;
  sectionName?: string;
  sectionCode?: string;
  // Skip compiling and render the fallback (`shouldForceSectionFallback`).
  forceFallback?: boolean;
  modules?: Record<string, unknown>;
  headers?: Record<string, boolean>;
  frame?: FrameProps;
  dynamicTailwind?: boolean;
  provider?: (children: React.ReactNode) => React.ReactNode;
}

// One canvas section: compiles its preview and renders it in its frame.
// Memoized: an unchanged section gets the same `preview` string, so React
// skips it entirely (#97).
const Renderer = ({
  preview,
  sectionId = '',
  sectionName = '',
  sectionCode = preview,
  forceFallback = false,
  headers,
  modules,
  frame,
  dynamicTailwind = false,
  provider,
}: Props) => {
  // A forced section compiles empty code, so none of its code runs.
  const module = useCompiledModule(forceFallback ? '' : preview, modules);
  const section = { id: sectionId, name: sectionName, code: sectionCode };
  const messages = useLiveMessages();

  // The section's Tailwind classes, compiled into a `<style>` rendered next
  // to its content. A shadow root has no stylesheet of its own, and only
  // inherited CSS crosses into it (`frame/shadow.tsx`).
  const { ref: wrapperRef, css: dynamicCSS } = useDynamicTailwind(
    preview,
    dynamicTailwind && !forceFallback,
  );

  const renderProvider = (component: React.ReactNode) => {
    return provider ? provider(component) : component;
  };

  // A section with no component shows its fallback in place of the frame,
  // as `Live.Preview` does for a compile error.
  if (forceFallback) {
    return (
      <SectionFallback
        args={{ section, reason: 'forced' }}
        builtin={
          <LiveError
            message={messages.errors.sectionNotRendered}
            title={messages.errors.sectionUnavailable}
          />
        }
      />
    );
  }

  if (module?.error) {
    return (
      <SectionFallback
        args={{ section, reason: 'compile', message: module.error }}
        builtin={
          <LiveError message={module.error} title={messages.errors.compile} />
        }
      />
    );
  }

  const Component = module?.exports?.default;

  if (!Component) {
    return null;
  }

  return (
    <Frame {...frame} autoHeight>
      {container => (
        <div
          ref={wrapperRef}
          className="w-full overflow-x-hidden"
          data-editor-mode
        >
          {/*
            Keeps a render error in this section, so it can't unmount the
            editor (#246). Inside the frame, so a passing error while typing
            doesn't rebuild the iframe. The next edit gives a new `preview`,
            which resets it.

            No `Error.Guard`, unlike `Live.Preview`: it listens on `window`,
            so one per section would make every section show any section's
            error. Errors also don't go to `ErrorContext`, which holds one
            string for the whole tree.
          */}
          <ErrorBoundary
            resetKeys={[preview]}
            fallback={(message, reset) => (
              <SectionFallback
                args={{ section, reason: 'runtime', message }}
                builtin={
                  <LiveError
                    message={message}
                    onReset={reset}
                    title={messages.errors.rendering}
                  />
                }
              />
            )}
          >
            {renderProvider(
              <>
                <Component
                  headers={headers}
                  container={container}
                  //
                />
                {dynamicTailwind && dynamicCSS && <style>{dynamicCSS}</style>}
              </>,
            )}
          </ErrorBoundary>
        </div>
      )}
    </Frame>
  );
};

// Compares `frame` by value, since it's usually written inline and is a new
// object every render (#348): arrays by their entries, objects (`style`)
// shallowly, anything else by identity, so a new `onLoaded` still
// re-renders.
const sameValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  }

  if (
    a &&
    b &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    Object.getPrototypeOf(a) === Object.prototype &&
    Object.getPrototypeOf(b) === Object.prototype
  ) {
    const aKeys = Object.keys(a);

    return (
      aKeys.length === Object.keys(b).length &&
      aKeys.every(key =>
        Object.is(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
      )
    );
  }

  return false;
};

const sameFrame = (a?: FrameProps, b?: FrameProps): boolean => {
  if (a === b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  return [...keys].every(key =>
    sameValue(a[key as keyof FrameProps], b[key as keyof FrameProps]),
  );
};

// Every other prop is compared by identity, as `memo` does by default.
const arePropsEqual = (prev: Props, next: Props): boolean => {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  return [...keys].every(key =>
    key === 'frame'
      ? sameFrame(prev.frame, next.frame)
      : Object.is(prev[key as keyof Props], next[key as keyof Props]),
  );
};

export default memo(Renderer, arePropsEqual);
