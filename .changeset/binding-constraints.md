---
'@jbpark/live-editor': minor
---

Add binding constraints: `minLength` / `maxLength` for text, `step` for numbers, `minItems` / `maxItems` for arrays, `minDate` / `maxDate` for dates, `protocols` for URLs, and `patternMessage` to say what a `pattern` expects. `validateBindingValue` checks them, and the built-in panel uses them: the number input gets `step`, and the Items editor disables add, duplicate and delete at the item limits. `useDndItems` takes `minItems` / `maxItems`, refuses actions past them, and returns `canAddItems` / `canRemoveItems`.

`ValidationMessages` gains `minLength`, `maxLength`, `step`, `minItems`, `maxItems`, `minDate`, `maxDate` and `protocol`. They show in English until translated, and a message set typed as the full `LiveMessages` needs them added.

These keys were carried in `meta` before. A binding that wrote one of them at the top level, such as `step: 5`, now gets it as the constraint, checked on edit, and no longer finds it in `meta`. Control settings belong on `widget` (`widget: { type: 'slider', step: 5 }`), which is unchanged.
