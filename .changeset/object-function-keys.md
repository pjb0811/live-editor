---
'@jbpark/live-editor': minor
---

The object editor edits an object-valued prop key by key when some keys aren't literals. A key declared `type: 'function'` in `render`, or an untyped one holding a function expression, gets the code editor (or a select with `options`) and is written as source, so `config={{ label: 'Go', onClick: () => go() }}` is no longer read-only as a whole. Keys holding other expressions are shown read-only on their own while the rest stay editable. An object with a spread, a computed key or a method stays code-editor-only.
