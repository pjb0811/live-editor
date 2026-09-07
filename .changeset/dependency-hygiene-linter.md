---
'@jbpark/live-editor': patch
---

Declare `codemirror` as a direct dependency instead of relying on it being
hoisted from another package, and stop masking this class of mistake: the six
packages imported from `src` but never declared (`codemirror`, `nanoid`, and
`@babel/parser|types|traverse|generator`) are now listed explicitly, and CI
runs `depcheck` so an undeclared or unused dependency fails the build.
