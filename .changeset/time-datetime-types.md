---
'@jbpark/live-editor': minor
---

Add the `time` and `datetime` binding types. `time` holds a 24-hour `HH:mm` value and the built-in panel draws it with ui-kit's time picker. `datetime` holds a local `YYYY-MM-DDTHH:mm` value with no zone, as `datetime-local` writes it, and the panel draws it with the date picker's time mode. `validateBindingValue` checks both formats, with the new `time` and `datetime` messages, and `getFieldKind` returns `'time'` and `'datetime'`.

`minDate` and `maxDate` now also accept `YYYY-MM-DDTHH:mm` and apply to `datetime`. A date-only bound covers the whole day, so `maxDate: '2026-12-31'` allows `2026-12-31T23:59`.
