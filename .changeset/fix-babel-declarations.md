---
'@jbpark/live-editor': patch
---

Keep Babel traverse implementation details out of generated declarations so strict TypeScript consumers can import the AST utilities without invalid Babel type references.
