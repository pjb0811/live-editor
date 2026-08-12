---
---

Demo-app-only change (pages/editor/\*) — not part of the published package (package.json's `files` is `["dist"]`), so no version bump is needed here. @codemirror/merge is a new dependency but is only imported from demo-app-only code, same as react-router-dom/antd/@ant-design/icons already in this package.json.
