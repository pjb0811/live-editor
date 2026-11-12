---
'@jbpark/live-editor': patch
---

Stop lowering preview code to ES5

`compile()` ran Babel's `env` preset without targets, which rewrote arrow functions, classes, destructuring and `async` functions into ES5 for no browser that React 19 runs in. The preset is gone, so preview code keeps that syntax as written, and compiling the default palette document (9 sections, 30.8 KB) takes about 63 ms instead of 98 ms in Node. A host that inspects the compiled output will see it change shape; no public API changes.
