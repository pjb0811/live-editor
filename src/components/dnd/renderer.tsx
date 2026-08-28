import { memo } from 'react';

import ErrorBoundary from '~/components/error/boundary';
import LiveError from '~/components/error/error';
import Frame, { type FrameProps } from '~/components/frame';
import { useCompiledModule } from '~/components/preview/use-compiled-module';
import { useDynamicTailwind } from '~/components/preview/use-dynamic-tailwind';

interface Props {
  preview: string;
  modules?: Record<string, unknown>;
  headers?: Record<string, boolean>;
  frame?: FrameProps;
  dynamicTailwind?: boolean;
  provider?: (children: React.ReactNode) => React.ReactNode;
}

// Wrapped in memo() because `preview` is a plain string: for a section that
// didn't change, the parent hands back the same content it computed last
// render (see generateSections()/dnd.tsx), so a shallow prop comparison
// lets React skip both the recompile below and reconciling this section's
// iframe tree at all — see #97.
const Renderer = ({
  preview,
  headers,
  modules,
  frame,
  dynamicTailwind = false,
  provider,
}: Props) => {
  const module = useCompiledModule(preview, modules);

  // In `shadow` mode there's no separate document to load a stylesheet into
  // — the shadow root only gets whatever CSS naturally inherits across the
  // boundary (see `frame/shadow.tsx`), not utility classes. So this section's
  // own Tailwind classes are compiled and portalled in as a `<style>` tag
  // alongside the rendered content, which crosses the shadow boundary fine
  // since it lives inside the same portal target.
  const { ref: wrapperRef, css: dynamicCSS } = useDynamicTailwind(
    preview,
    dynamicTailwind,
  );

  const renderProvider = (component: React.ReactNode) => {
    return provider ? provider(component) : component;
  };

  // Rendered in place of the frame rather than inside it: there is nothing to
  // portal into an iframe for code that never produced a component, and a
  // silent blank slot (the previous behaviour) gives the author no clue why
  // their section vanished. Mirrors preview/client.tsx's compile-error branch.
  if (module?.error) {
    return <LiveError message={module.error} title="Compile Error" />;
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
            Without this, a render error in any single canvas section
            propagated past Dnd and unmounted the whole editor — palette,
            canvas and panel — while the same error in <Preview> was caught
            and displayed (see #246). Kept inside the frame so the failure is
            reported in the slot the broken section occupies, and so a
            transient error while the author is mid-edit doesn't tear down and
            rebuild the iframe (script loading, style sync, resize observers)
            on every keystroke. `Error` is inline-styled, so it stays readable
            even in a frame that never received the host's CSS.

            resetKeys={[preview]} makes the fix itself the recovery signal: the
            next edit to this section produces a new preview string, which
            clears the caught error without needing a remount.

            No `Error.Guard` here, unlike client.tsx: it listens on `window`,
            not on its subtree, so one per section would mean N global
            listeners all tripping on any single error — every section would
            show a runtime error regardless of which one actually threw.

            Errors also stay local rather than going to ErrorContext, whose
            `error` is a single string shared by the whole tree: N sections
            reporting into it would overwrite each other with no way to tell
            which section failed.
          */}
          <ErrorBoundary resetKeys={[preview]}>
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

export default memo(Renderer);
