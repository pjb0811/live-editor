---
'@jbpark/live-editor': patch
---

Read and write negative numbers in bindings and `items` values

A negative number typed into a number field of the Items editor threw `NumericLiterals must be non-negative finite numbers` and the edit was lost without a message. An attribute such as `count={-5}` was also read as the string `"-5"`, so it got a text control, and an edit rewrote it as the string attribute `count="-7"`.

Negative numbers are now written as `-n`, `count={-5}` reads as the number `-5`, and `parseValue('-5')` returns `-5`. Text that isn't a number in a number item, such as `abc`, is refused with the usual items error instead of throwing.
