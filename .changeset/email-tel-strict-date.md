---
'@jbpark/live-editor': minor
---

Add the `email` and `tel` binding types. The built-in panel draws them with the browser's email and phone inputs. `email` checks for a `name@domain.tld` shape; `tel` has no built-in format, since phone formats differ by country, so use `pattern` for one. `getFieldKind` returns `'email'` and `'tel'` for them, and `ValidationMessages` gains `email` and the panel messages `emailPlaceholder` and `telPlaceholder`.

`type: 'date'` now accepts only a `YYYY-MM-DD` value naming a real day, the format the date picker writes. Before, anything `Date.parse` read passed, including `1` and `2026/10/13`, and `2026-02-30` rolled over to March. This changes only what `validateBindingValue` accepts on edit; existing source isn't rewritten.
