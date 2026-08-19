---
'@jbpark/live-editor': patch
---

Fixed `Live.Preview` silently ignoring the `frame` prop whenever a `code` prop was also passed — `code` and `frame` previously took two divergent render paths, and only one of them wrapped its output in `<Frame>`. `dynamicTailwind` also now works together with `frame`, which it couldn't before this fix.
