---
'@jbpark/live-editor': patch
---

Show Babel's message when preview code doesn't compile

When preview code didn't compile, `Live.Preview` and each canvas section showed the browser's `new Function` syntax error, such as `Unexpected token '<'`, instead of Babel's, and Babel's error was logged with `console.error` on every failed compile. The error now is Babel's message with its line and column and a code frame, for example `Unterminated JSX contents. (1:23)`, and a failed compile no longer logs by itself.
