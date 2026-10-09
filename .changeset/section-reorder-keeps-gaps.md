---
'@jbpark/live-editor': patch
---

Moving a section with the arrow buttons, or dragging it to a new position, no longer deletes what sits between the sections. A comment, another element, a conditional expression, text, or a wrapper element around a section used to disappear, and swapping sections that lived in different wrappers left both in the first one. The sections now trade places and everything else stays where it was. Adding, copying, editing and deleting a single section are unchanged.
