import { isAnimationActive } from './measure';

// `getAnimations()` mixes CSS animations, CSS transitions and script
// animations (`element.animate()`). Only the first two fire a bubbling event
// when they end, so they're told apart. Both constructors are checked first,
// since jsdom has neither.
export const isCssAnimation = (
  win: Window & typeof globalThis,
  animation: Animation,
): boolean =>
  typeof win.CSSAnimation === 'function' &&
  animation instanceof win.CSSAnimation;

export const isCssTransition = (
  win: Window & typeof globalThis,
  animation: Animation,
): boolean =>
  typeof win.CSSTransition === 'function' &&
  animation instanceof win.CSSTransition;

// Whether the element is animating, which tells a passing `opacity: 0` (the
// start of a fade-in, so measure it) from a lasting one (a closed overlay, so
// skip it). Transitions count too: a measurement pass doesn't always freeze
// them, so a fade-in can read `opacity: 0` with a transition running. Without
// `getAnimations()` (jsdom, old browsers) this is false, which under-measures
// a fading-in overlay rather than counting a closed one.
export const hasActiveAnimation = (el: HTMLElement): boolean =>
  typeof el.getAnimations === 'function' &&
  el.getAnimations().some(animation => isAnimationActive(animation.playState));

// An animation that repeats forever never resolves `finished`, so it gets no
// handler. It's always animating, so `hasActiveAnimation` keeps it measured
// anyway.
export const neverFinishes = (animation: Animation): boolean => {
  const timing = animation.effect?.getComputedTiming();

  return timing?.iterations === Infinity || timing?.duration === Infinity;
};
