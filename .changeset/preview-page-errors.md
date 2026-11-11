---
'@jbpark/live-editor': patch
---

Stop an unrelated page error from unmounting or hiding `Live.Preview`

`Live.Preview` listens for `error` and `unhandledrejection` on `window`, so any error on the page reached it, including errors from the host app and the browser's benign `ResizeObserver loop` notice. Such an error replaced the previewed component with a "Runtime Error" box, which unmounted it and lost its state. With `showError` and a `code` prop, the preview could stay hidden for good: the visible box had no button, and fixing the code didn't clear it.

- The error box now shows next to the preview instead of replacing it, so the previewed component keeps its state.
- The `ResizeObserver loop completed with undelivered notifications` and `ResizeObserver loop limit exceeded` notices are ignored.
- The listeners no longer call `preventDefault()`, so the browser reports the error in the console again, with its stack.
- With `showError`, the error box has a "Try Again" button, and the error clears when the code changes.
