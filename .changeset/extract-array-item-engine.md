---
'@jbpark/live-editor': patch
---

Move the array-item editing engine out of the panel component into `utils/ast`

`panel/items.tsx` held an AST editing engine that mutated the `t.ObjectExpression` nodes in its own `useMemo` result, serialized the array, then mutated them back — smuggling JSX past the generator as `__JSX_<id>__` identifiers that were string-substituted into the output afterwards. That logic now lives in `src/utils/ast/items.ts` as pure string-in/string-out functions (`updateArrayItemProperty`, `updateArrayItemValue`, `moveArrayItem`, `moveArrayItems`, `removeArrayItems`, `duplicateArrayItems`, `appendArrayItem`, `parseItems`), each re-parsing the array source so nothing is shared with component state.

The placeholder round-trip is gone: Babel prints JSX inside an object literal correctly, and a raw JSX value parses straight into a node. A value containing `$&` or `$$` can no longer be mangled by the substitution step that used to follow generation.

Two bugs fixed along the way:

- An `object`/`array` property was coerced to a JS value and then `String()`-ed back before parsing, so `[1, 2]` became `"1,2"` and parsed as a sequence expression. Serialized source text is now parsed directly, a real JS value is rebuilt only when the property held nothing but literals — otherwise the edit is refused rather than dropping an identifier, call or spread the evaluation could not represent — and coercion is applied only where a scalar literal is built.
- Editing an array that mixes objects and primitives silently dropped the primitives, because the object handlers rebuilt the array from the object items alone. Every function now addresses items by their position among the array's elements.

Also hardened: an `innerHTML` value containing a backtick, `${`, a backslash or a carriage return threw `Invalid raw` out of the edit handler or lost its line endings instead of being written verbatim, and the "don't delete the last item" guard now counts items of the kind being edited, so the object panel can no longer delete its last object just because a primitive keeps the array non-empty.

The functions are exported from `@jbpark/live-editor/utils/ast`. `moveSelectedIndices`/`removeIndices` moved from `components/dnd/panel/selection` to `utils/selection`; they were not part of the public API.
