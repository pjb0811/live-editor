---
'@jbpark/live-editor': patch
---

Hide the inner scrollbar of `autoHeight` iframes. Because `autoHeight` sets the iframe's height to `Math.ceil(contentHeight)`, sub-pixel content or a rounding remainder could leave the document a fraction taller than its viewport — enough for the browser to draw a vertical scrollbar inside the iframe. In Dnd mode, where every section renders its own `autoHeight` iframe, this showed up as a stray scrollbar on each stacked section. A persistent `scrollbar-width: none` / `::-webkit-scrollbar { display: none }` style now hides only the chrome (not scrolling itself, so content that ever genuinely exceeds the measured height stays reachable), and is removed again if `autoHeight` is turned off.
