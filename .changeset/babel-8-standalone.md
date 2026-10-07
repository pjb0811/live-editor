---
'@jbpark/live-editor': major
---

Require Node.js `^22.18.0 || >=24.11.0`. The runtime compiler, `@babel/standalone`, is now on Babel 8, which supports only that range, so `engines.node` moves from `>=20` to match. On older Node, npm warns on install and pnpm with `engine-strict` refuses it. Upgrade Node to 22.18 or later, or stay on 4.x.

Compiled preview code is unchanged: JSX still compiles to `React.createElement`, so documents need no `react/jsx-runtime`.
