---
'@jbpark/live-editor': patch
---

Remove the `antd` and `@ant-design/icons` dependencies. Neither was used by the published package (`dist` imports only `@jbpark/ui-kit`) — they were pulled in solely by the demo editor page, so consumers were installing both for nothing. The demo's toolbar now uses `@jbpark/ui-kit` (`Button`, `Radio`, `Space`, `Splitter`, `Toast`) and `lucide-react` icons instead, matching the rest of the codebase, and both antd packages are dropped from `dependencies`.
