---
'@jbpark/live-editor': minor
---

Edit function props such as event handlers from the panel

A binding on a prop that takes a function, such as `onClick`, showed the expression as read-only, and `update()` refused every value with `unsupported-syntax`. The new binding type `function` edits it as source text that is never run: the panel shows a code editor, or a select of handlers when the binding has `options` (`{ label: 'Open modal', value: 'actions.openModal' }` writes `onClick={actions.openModal}`). An edit takes an arrow function, a `function` expression or a reference such as `handleClick`; anything else, including a call such as `alert('hi')`, is refused with the new failure reason `invalid-function`. Clearing the value removes the attribute.

A binding with no `type` on an attribute that already holds an arrow function or a `function` expression is now treated as `type: 'function'`, so it shows the code editor instead of the read-only note, and its `PanelBinding` arrives with `type: 'function'`. A bare reference such as `onClick={handleClick}` with no `type` stays read-only.

`BindingType`, `FieldKind` and `UpdateFailure['reason']` each gain a member, so an exhaustive `switch` over one of them needs a new case. `LiveMessages` gains `panel.noFunction` and `editErrors.invalidFunction`, which a full custom message set has to add.
