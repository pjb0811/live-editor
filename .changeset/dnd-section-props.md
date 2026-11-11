---
'@jbpark/live-editor': patch
---

Pass `Live.Dnd`'s `props` to the sections' component

The docs describe `Live.Dnd`'s `props` as props for the sections, but a section's component received only `container` and a leftover `headers` prop. The `props` were spread onto the internal section renderer instead, so a key named like one of its own props (`preview`, `frame`, `modules`, `provider`, `sectionId`) changed how the section was compiled or framed. `preview` replaced the section's content.

A section's component now receives every key of `props`, plus `container`, as `Live.Preview`'s component does, and so does the copy shown while a section is dragged. An inline `props` object whose entries are unchanged still doesn't re-render the sections.
