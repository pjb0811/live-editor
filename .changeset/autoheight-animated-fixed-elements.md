---
'@jbpark/live-editor': patch
---

Stop `autoHeight` from dropping elements that are still animating. A
`position: fixed`/`absolute` element part-way through a fade-in sits at
computed `opacity: 0`, which the measurement walk read as permanently hidden
and left out of the height — a section whose only content was such an element
kept the browser's default 150px iframe height, and one with flow content was
clipped to it. An element at `opacity: 0` with a running or paused keyframe
animation is now measured, while a closed overlay and a finished fade-out
holding `opacity: 0` through `animation-fill-mode: forwards` stay excluded.

The height is also re-measured when an animation settles, which no observer
used to notice: a finishing animation is neither a DOM mutation nor a resize,
so a height read mid-fade stayed on the iframe until something unrelated
happened to the DOM. CSS animations are picked up through bubbling
`animationend`/`animationcancel`, and script-driven ones (`element.animate()`)
through their `finished` promise, since the Web Animations API dispatches no
DOM event.
