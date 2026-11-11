---
'@jbpark/live-editor': patch
---

Render `Live.Dnd` and a framed `Live.Preview` on the server without throwing

Server rendering, including Next.js pre-rendering a `'use client'` component, threw `ReferenceError: document is not defined` for `Live.Dnd` and for `Live.Preview` with a `frame`. Both now render on the server and show their previews once the page hydrates, with no hydration mismatch. They no longer compile or run the previewed code on the server, since its output can't reach the server HTML. A `Live.Preview` without `frame` renders on the server as before.

The docs and READMEs have a new "Next.js and server rendering" section.
