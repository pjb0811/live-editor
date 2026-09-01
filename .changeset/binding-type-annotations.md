---
'@jbpark/live-editor': minor
---

Honor `satisfies`/`as` type annotations on authored `data-binding` arrays

An authored `data-binding={[...] satisfies BindingItem[]}` (or `as const`, a type assertion, or extra parentheses) previously made the top-level node a `TSSatisfiesExpression`, so the array was not recognized and the whole binding was silently dropped. These build-time-erased wrappers are now unwrapped, so the inline type-safety pattern works end to end.

Internally, `extract` now evaluates `data-binding` straight off the parsed `ArrayExpression` instead of re-serializing it and re-parsing the string — removing the redundant parse round-trip with no change to the parsed result or the value contract.
