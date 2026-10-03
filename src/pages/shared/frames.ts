import type { FrameProps } from '~/components/frame';

// An iframe preview that copies the host's stylesheets and theme in, and
// loads the Tailwind browser build so classes typed into the code render
// without a build step.
export const IFRAME_FRAME: FrameProps = {
  mode: 'iframe',
  syncStyle: true,
  scripts: ['/js/tailwindcss.js'],
};

// A shadow-root preview. Tailwind comes from `dynamicTailwind` on the
// component that renders it, since a shadow root can't run a script of its
// own.
export const SHADOW_FRAME: FrameProps = {
  mode: 'shadow',
  syncStyle: true,
};
