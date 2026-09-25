---
'@jbpark/live-editor': patch
---

Stop `autoHeight` measurement from cancelling the preview's own CSS
transitions. The measurement pass applied `transition: none !important` to
every element, which does not pause a transition for the duration of the read
— it cancels it, and lifting the override afterwards does not resume it. Since
a DOM mutation is both what schedules a measurement and what typically starts
a transition (a class toggle opening an overlay), a fading overlay snapped
straight to its end state.

The override is now applied only on a pass that actually moves the probe
height, which is the only thing the measurement itself changes. A pass that
leaves the probe height alone changes nothing about the document, so there is
nothing to freeze.

Two consequences of transitions being allowed to run: the height is
re-measured on `transitionend`/`transitioncancel`, which no observer used to
notice, and an element at `opacity: 0` with a running transition now counts as
in flight for the height estimate, the same as one with a running keyframe
animation.
